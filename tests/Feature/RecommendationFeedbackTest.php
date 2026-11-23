<?php

namespace Tests\Feature;

use App\Models\Leads;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecommendationFeedback;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Pitched / Accepted / Declined on a drink idea, and order lines that came from one, through the real routes. */
class RecommendationFeedbackTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private Leads $lead;
    private Product $product;
    private Recipe $drink;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        config(['ife.claude.enabled' => false]);

        $this->rep      = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));
        $this->otherRep = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));

        $this->lead = Leads::create([
            'name' => 'Cafe Sdn Bhd', 'business_name' => 'Cafe', 'belong_to' => $this->rep->id, 'assign_to' => $this->rep->id,
            'business_category' => 2, 'segment' => 'premium', 'area_types' => ['office'],
        ]);

        $this->product = Product::create([
            'sku' => 'OAT', 'name' => 'Oat Milk', 'unit' => 'litre', 'unit_price' => 14, 'is_active' => true, 'base_monthly_qty' => 10,
        ]);

        $this->drink = Recipe::create(['name' => 'Test Oat Latte', 'slug' => 'test-oat-latte-' . uniqid(), 'serve' => 'iced', 'is_active' => true]);
    }

    private function send(array $body)
    {
        return $this->postJson('/api/mobile/leads/recommendations/feedback', ['lead_id' => $this->lead->id, 'recipe_id' => $this->drink->id] + $body);
    }

    public function test_the_mobile_endpoint_records_who_answered_what(): void
    {
        Sanctum::actingAs($this->rep);

        $this->send(['status' => 'pitched'])
            ->assertOk()
            ->assertJsonPath('data.drink_feedback.' . $this->drink->id, 'pitched');

        $row = RecommendationFeedback::where('lead_id', $this->lead->id)->firstOrFail();

        $this->assertSame($this->drink->id, $row->recipe_id);
        $this->assertSame($this->rep->id, $row->user_id);
        $this->assertSame('pitched', $row->status);
    }

    public function test_a_rep_cannot_answer_for_someone_elses_outlet(): void
    {
        Sanctum::actingAs($this->otherRep);

        $this->send(['status' => 'declined']);

        $this->assertSame(0, RecommendationFeedback::where('lead_id', $this->lead->id)->count());
    }

    public function test_an_unknown_status_or_a_missing_drink_is_refused(): void
    {
        Sanctum::actingAs($this->rep);

        $this->send(['status' => 'maybe'])->assertStatus(422);
        $this->postJson('/api/mobile/leads/recommendations/feedback', ['lead_id' => $this->lead->id, 'status' => 'pitched'])->assertStatus(422);
    }

    public function test_a_drink_can_be_declined_with_a_reason_and_the_answer_taken_back(): void
    {
        Sanctum::actingAs($this->rep);

        $this->send(['status' => 'declined', 'reason' => 'too_expensive'])
            ->assertOk()
            ->assertJsonPath('data.drink_feedback.' . $this->drink->id, 'declined')
            ->assertJsonPath('data.drink_reasons.' . $this->drink->id, 'too_expensive');

        // A reason only goes with a decline.
        $this->send(['status' => 'pitched', 'reason' => 'too_expensive'])->assertOk();
        $this->assertNull(RecommendationFeedback::where('recipe_id', $this->drink->id)->latest('id')->value('reason'));

        $this->send(['status' => 'cleared'])->assertOk();
        $this->assertArrayNotHasKey($this->drink->id, RecommendationFeedback::answersFor($this->lead)['drink_feedback']);

        $this->send(['status' => 'declined', 'reason' => 'the moon'])->assertStatus(422);
    }

    public function test_answers_are_added_never_replaced_and_the_newest_one_counts(): void
    {
        RecommendationFeedback::record($this->lead, $this->rep, ['recipe_id' => $this->drink->id, 'status' => 'pitched']);
        RecommendationFeedback::record($this->lead, $this->rep, ['recipe_id' => $this->drink->id, 'status' => 'accepted']);

        $this->assertSame(['pitched', 'accepted'], RecommendationFeedback::where('lead_id', $this->lead->id)->orderBy('id')->pluck('status')->all());
        $this->assertSame('accepted', RecommendationFeedback::answersFor($this->lead)['drink_feedback'][$this->drink->id]);
    }

    public function test_a_saved_order_keeps_which_lines_came_from_a_suggestion(): void
    {
        $other = Product::create(['sku' => 'BEAN', 'name' => 'Beans', 'unit' => 'kg', 'unit_price' => 80, 'is_active' => true]);

        $order = app(OrderService::class)->record($this->lead, $this->rep, [
            ['product_id' => $this->product->id, 'quantity' => 2, 'suggested' => true],
            ['product_id' => $other->id, 'quantity' => 1],
        ]);

        $lines = OrderLine::where('order_id', $order->id)->get()->keyBy('product_id');

        $this->assertTrue($lines[$this->product->id]->suggested);
        $this->assertFalse($lines[$other->id]->suggested);
    }

    public function test_the_mobile_order_route_keeps_the_marker_too(): void
    {
        Sanctum::actingAs($this->rep);

        $this->postJson('/api/mobile/leads/orders/create', [
            'lead_id' => $this->lead->id,
            'lines'   => [['product_id' => $this->product->id, 'quantity' => 2, 'suggested' => true]],
        ])->assertOk();

        $this->assertTrue((bool) OrderLine::where('product_id', $this->product->id)->latest('id')->value('suggested'));
    }

    public function test_area_profile_and_halal_reach_the_app(): void
    {
        $this->lead->update(['is_halal' => true, 'district' => 'Petaling', 'income_group' => 'M40', 'area_source' => 'seeded', 'area_profiled_at' => now()]);

        $area = $this->lead->fresh()->areaProfile();

        $this->assertSame('Petaling', $area['district']);
        $this->assertSame(['office'], $area['area_types']);
        $this->assertSame('seeded', $area['source']);
    }

    public function test_saving_a_product_stores_halal_and_its_typical_quantity(): void
    {
        $admin = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));

        $this->actingAs($admin)->post(route('product.update', $this->product->id), [
            'sku'              => 'OAT',
            'name'             => 'Oat Milk',
            'unit'             => 'litre',
            'unit_price'       => 14,
            'is_active'        => true,
            'is_halal'         => '1',
            'base_monthly_qty' => 8,
        ])->assertRedirect();

        $product = $this->product->fresh();

        $this->assertTrue($product->is_halal);
        $this->assertSame(8.0, $product->base_monthly_qty);
    }

    public function test_the_outlet_page_carries_halal_and_the_area(): void
    {
        $manager = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_MANAGER, 'status' => 1]));

        $this->lead->update(['is_halal' => true, 'district' => 'Petaling', 'income_group' => 'M40', 'area_source' => 'seeded', 'area_profiled_at' => now()]);

        $this->withoutVite()->actingAs($manager)->get(route('lead.view', $this->lead->id))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Leads/Show')
                ->where('lead.is_halal', true)
                ->where('lead.area.district', 'Petaling'));
    }

    public function test_the_web_feedback_route_answers_only_for_visible_outlets(): void
    {
        $this->actingAs($this->otherRep)
            ->postJson(route('lead.recommendations.feedback', $this->lead->id), ['recipe_id' => $this->drink->id, 'status' => 'pitched'])
            ->assertNotFound();

        $this->actingAs($this->rep)
            ->postJson(route('lead.recommendations.feedback', $this->lead->id), ['recipe_id' => $this->drink->id, 'status' => 'pitched'])
            ->assertOk()
            ->assertJsonPath('data.drink_feedback.' . $this->drink->id, 'pitched');

        $this->assertSame(1, RecommendationFeedback::where('lead_id', $this->lead->id)->count());
    }
}
