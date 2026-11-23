<?php

namespace Tests\Feature;

use App\Models\Leads;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "What the outlet needs" on the outlet forms: main customers, best-selling
 * drinks, what the owner wants to improve and the typical drink price.
 */
class OutletNeedsTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $rep;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        $this->withoutVite();

        $this->admin = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));
        $this->rep   = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));
    }

    private function lead(User $owner): Leads
    {
        return Leads::create(['name' => 'Needs Cafe', 'business_name' => 'Needs Cafe', 'mobile' => '60123456789', 'belong_to' => $owner->id, 'assign_to' => $owner->id]);
    }

    private function webForm(Leads $lead, array $needs): array
    {
        return $needs + [
            'id' => $lead->id, 'receive_date' => now()->toDateString(), 'customer_id' => '', 'name' => 'Needs Cafe',
            'business_name' => 'Needs Cafe', 'mobile' => '60123456789',
        ];
    }

    public function test_the_web_form_saves_the_needs_and_an_empty_answer_clears_it(): void
    {
        $lead = $this->lead($this->admin);

        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, [
            'main_customers'      => ['university'],
            'best_selling_kinds'  => ['coffee', 'kopitiam', 'coffee'],
            'improvement_goals'   => ['expand_menu', 'average_spend'],
            'typical_drink_price' => '9.5',
        ]))->assertSessionHasNoErrors();

        $lead->refresh();
        $this->assertSame(['university'], $lead->main_customers);
        $this->assertSame(['coffee', 'kopitiam'], $lead->best_selling_kinds, 'a repeated kind is kept once');
        $this->assertSame(['expand_menu', 'average_spend'], $lead->improvement_goals);
        $this->assertSame(9.5, $lead->typical_drink_price);

        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, [
            'main_customers' => [], 'best_selling_kinds' => [], 'improvement_goals' => [], 'typical_drink_price' => '',
        ]))->assertSessionHasNoErrors();

        $lead->refresh();
        $this->assertNull($lead->main_customers);
        $this->assertNull($lead->best_selling_kinds);
        $this->assertNull($lead->improvement_goals);
        $this->assertNull($lead->typical_drink_price);
    }

    public function test_only_known_kinds_goals_and_sensible_prices_pass(): void
    {
        $lead = $this->lead($this->admin);

        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, ['best_selling_kinds' => ['beer']]))
            ->assertSessionHasErrors('best_selling_kinds.0');
        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, ['improvement_goals' => ['get_rich']]))
            ->assertSessionHasErrors('improvement_goals.0');
        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, ['typical_drink_price' => '0.5']))
            ->assertSessionHasErrors('typical_drink_price');
        $this->actingAs($this->admin)->post(route('lead.update'), $this->webForm($lead, ['typical_drink_price' => '250']))
            ->assertSessionHasErrors('typical_drink_price');
    }

    public function test_the_outlet_page_and_form_get_the_needs_and_their_choices(): void
    {
        $lead = $this->lead($this->admin);
        $lead->update(['best_selling_kinds' => ['tea'], 'improvement_goals' => ['new_customers'], 'typical_drink_price' => 7]);

        $this->actingAs($this->admin)->get(route('lead.view', $lead->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('lead.best_selling_kinds', ['tea'])
                ->where('lead.improvement_goals', ['new_customers'])
                ->where('lead.typical_drink_price', 7)
                ->has('drinkKinds', 8)
                ->where('goals.0', ['value' => 'expand_menu', 'label' => 'Expand the menu'])
                ->has('goals', 5)
            );

        $this->actingAs($this->admin)->get(route('lead.edit', $lead->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('drinkKinds', 8)->has('goals', 5));
    }

    public function test_the_phone_saves_the_needs_and_shows_them_by_name(): void
    {
        Sanctum::actingAs($this->rep);

        $id = $this->postJson('/api/mobile/leads/create', [
            'name' => 'Phone Cafe', 'business_name' => 'Phone Cafe', 'mobile' => '60123456789', 'receive_date' => now()->toDateString(),
            'main_customers' => ['office'], 'best_selling_kinds' => ['fruit_tea'], 'improvement_goals' => ['ingredient_cost'], 'typical_drink_price' => '12',
        ])->assertOk()->json('data.lead.id');

        $this->getJson("/api/mobile/leads/get?leadID={$id}")
            ->assertOk()
            ->assertJsonPath('data.best_selling_kinds', ['fruit_tea'])
            ->assertJsonPath('data.improvement_goals', ['ingredient_cost'])
            ->assertJsonPath('data.typical_drink_price', 12)
            ->assertJsonPath('data.needs.main_customers', [config('ife.recommendation.customer_groups.office')])
            ->assertJsonPath('data.needs.best_selling_kinds', ['Fruit tea'])
            ->assertJsonPath('data.needs.improvement_goals', ['Reduce ingredient cost']);

        $this->getJson('/api/mobile/leads/filterOptions')
            ->assertOk()
            ->assertJsonCount(8, 'data.drink_kinds')
            ->assertJsonPath('data.goals.4', ['value' => 'improve_drinks', 'label' => 'Improve existing drinks']);
    }

    public function test_the_demo_seeder_fills_believable_needs_and_keeps_a_reps_own_answers(): void
    {
        $answered = $this->lead($this->admin);
        $answered->update(['improvement_goals' => ['improve_drinks']]);
        $cafes = collect(range(1, 12))->map(fn () => Leads::create(['name' => 'Seed Cafe', 'business_category' => 2, 'segment' => 'budget', 'belong_to' => $this->admin->id]));

        $this->seed(\Database\Seeders\OutletNeedsSeeder::class);

        $answered->refresh();
        $this->assertSame(['improve_drinks'], $answered->improvement_goals);
        $this->assertNull($answered->best_selling_kinds, 'an outlet with any answer is left alone');

        $filled = $cafes->map->fresh()->filter(fn (Leads $lead) => $lead->best_selling_kinds || $lead->typical_drink_price !== null);
        $this->assertGreaterThan(6, $filled->count(), 'most outlets get answers');
        foreach ($filled as $lead) {
            $this->assertEmpty(array_diff($lead->best_selling_kinds ?? [], ['coffee', 'flavoured_coffee', 'matcha', 'chocolate']), 'a cafe sells cafe drinks');
            if ($lead->typical_drink_price !== null) {
                $this->assertLessThan(8, $lead->typical_drink_price, 'a budget outlet has budget prices');
            }
        }
    }

    public function test_an_older_app_that_does_not_send_the_needs_keeps_them(): void
    {
        $lead = $this->lead($this->rep);
        $lead->update(['best_selling_kinds' => ['matcha'], 'improvement_goals' => ['improve_drinks'], 'typical_drink_price' => 15]);

        Sanctum::actingAs($this->rep);
        $this->postJson('/api/mobile/leads/edit', [
            'id' => $lead->id, 'name' => 'Needs Cafe', 'mobile' => '60123456789', 'receive_date' => now()->toDateString(),
        ])->assertOk();

        $lead->refresh();
        $this->assertSame(['matcha'], $lead->best_selling_kinds);
        $this->assertSame(['improve_drinks'], $lead->improvement_goals);
        $this->assertSame(15.0, $lead->typical_drink_price);
    }
}
