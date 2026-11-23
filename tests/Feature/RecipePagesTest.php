<?php

namespace Tests\Feature;

use App\Models\Leads;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecommendationFeedback;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** The Admin drinks pages, and "Main customers" on the outlet form. */
class RecipePagesTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Product $espresso;
    private Product $milk;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        // The pages are checked through their Inertia props, not the built assets.
        $this->withoutVite();

        $this->admin    = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));
        $this->espresso = Product::create(['sku' => 'TEST-ESP-' . uniqid(), 'name' => 'Test Espresso', 'unit' => 'kg', 'unit_price' => 75, 'is_active' => true, 'is_halal' => true]);
        $this->milk     = Product::create(['sku' => 'TEST-MILK-' . uniqid(), 'name' => 'Test Milk', 'unit' => 'litre', 'unit_price' => 7.5, 'is_active' => true, 'is_halal' => true]);
    }

    private function drink(array $overrides = []): array
    {
        return array_merge([
            'name'            => 'Test Flat White ' . uniqid(),
            'serve'           => 'hot',
            'customer_groups' => ['office', 'residential'],
            'outlet_types'    => [2],
            'price_tier'      => 'mid_range',
            'is_active'       => true,
            'ingredients'     => [
                ['product_id' => $this->espresso->id, 'quantity' => 0.018, 'amount_label' => '18 g'],
                ['product_id' => $this->milk->id, 'quantity' => 0.15, 'amount_label' => '150 ml'],
            ],
        ], $overrides);
    }

    public function test_only_admins_can_open_the_drinks_pages(): void
    {
        $rep = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));

        $this->actingAs($rep)->get(route('recipe.index'))
            ->assertInertia(fn (Assert $page) => $page->component('Errors/CustomError'));
        $this->actingAs($this->admin)->get(route('recipe.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Recipes/Index')->has('options.customerGroups', 8));
    }

    public function test_an_admin_adds_a_drink_with_its_ingredients_in_order(): void
    {
        $response = $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Flat White']));

        $recipe = Recipe::with('ingredients')->where('name', 'Test Flat White')->firstOrFail();
        $response->assertRedirect(route('recipe.view', $recipe->id));

        $this->assertSame('test-flat-white', $recipe->slug);
        $this->assertSame(['office', 'residential'], $recipe->customer_groups);
        $this->assertSame([$this->espresso->id, $this->milk->id], $recipe->ingredients->pluck('product_id')->all());
        $this->assertSame('18 g', $recipe->ingredients->first()->amount_label);

        $this->actingAs($this->admin)->get(route('recipe.view', $recipe->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Recipes/Show')
                ->where('recipe.cost_per_serve', 2.48) // 0.018 x 75 + 0.15 x 7.5
                ->where('recipe.is_halal', true));
    }

    public function test_a_drink_cannot_use_an_inactive_product(): void
    {
        $this->milk->update(['is_active' => false]);

        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Inactive Drink']))
            ->assertSessionHasErrors('ingredients.1.product_id');

        $this->assertFalse(Recipe::where('name', 'Test Inactive Drink')->exists());
    }

    public function test_a_drink_needs_a_product_and_the_same_one_only_once(): void
    {
        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['ingredients' => []]))
            ->assertSessionHasErrors('ingredients');

        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['ingredients' => [
            ['product_id' => $this->milk->id, 'quantity' => 0.1],
            ['product_id' => $this->milk->id, 'quantity' => 0.1],
        ]]))->assertSessionHasErrors('ingredients.0.product_id');
    }

    public function test_editing_replaces_the_ingredients_and_keeps_the_slug_unique(): void
    {
        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Latte']));
        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Latte!']));
        $second = Recipe::where('name', 'Test Latte!')->firstOrFail();
        $this->assertSame('test-latte-2', $second->slug);

        $this->actingAs($this->admin)->post(route('recipe.update', $second->id), $this->drink([
            'name'        => 'Test Latte!',
            'ingredients' => [['product_id' => $this->milk->id, 'quantity' => 0.2, 'amount_label' => '200 ml']],
        ]))->assertRedirect(route('recipe.view', $second->id));

        $this->assertSame([$this->milk->id], $second->fresh()->ingredients->pluck('product_id')->all());
    }

    public function test_a_drink_with_rep_feedback_is_deactivated_not_deleted(): void
    {
        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Answered']));
        $this->actingAs($this->admin)->post(route('recipe.store'), $this->drink(['name' => 'Test Unanswered']));
        $answered   = Recipe::where('name', 'Test Answered')->firstOrFail();
        $unanswered = Recipe::where('name', 'Test Unanswered')->firstOrFail();

        $lead = Leads::create(['name' => 'Test Outlet', 'business_name' => 'Test Outlet', 'belong_to' => $this->admin->id]);
        RecommendationFeedback::create(['lead_id' => $lead->id, 'recipe_id' => $answered->id, 'user_id' => $this->admin->id, 'status' => 'declined']);

        $this->actingAs($this->admin)->post(route('recipe.delete'), ['id' => $answered->id]);
        $this->actingAs($this->admin)->post(route('recipe.delete'), ['id' => $unanswered->id]);

        $this->assertFalse($answered->fresh()->is_active);
        $this->assertNull(Recipe::find($unanswered->id));
    }

    public function test_main_customers_are_saved_from_the_outlet_form_and_only_known_groups_pass(): void
    {
        $lead = Leads::create(['name' => 'Test Kopitiam', 'business_name' => 'Test Kopitiam', 'belong_to' => $this->admin->id, 'assign_to' => $this->admin->id]);

        $form = [
            'id' => $lead->id, 'receive_date' => now()->toDateString(), 'customer_id' => '', 'name' => 'Test Kopitiam', 'business_name' => 'Test Kopitiam',
            'mobile' => '60123456789', 'main_customers' => ['university', 'transit'],
        ];

        $this->actingAs($this->admin)->post(route('lead.update'), $form);
        $this->assertSame(['university', 'transit'], $lead->fresh()->main_customers);

        $this->actingAs($this->admin)->post(route('lead.update'), ['main_customers' => ['aliens']] + $form)
            ->assertSessionHasErrors('main_customers.0');

        // Clearing the dropdown clears the answer.
        $this->actingAs($this->admin)->post(route('lead.update'), ['main_customers' => []] + $form);
        $this->assertNull($lead->fresh()->main_customers);
    }
}
