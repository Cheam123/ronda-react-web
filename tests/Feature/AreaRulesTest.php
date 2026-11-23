<?php

namespace Tests\Feature;

use App\Models\AreaRule;
use App\Models\Leads;
use App\Models\User;
use Database\Seeders\AreaRuleSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** Admin > Drinks > Area rules, and the area profile the outlet page shows. */
class AreaRulesTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        $this->withoutVite();
        AreaRule::query()->delete();

        $this->admin = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1]));
    }

    private function rulesPayload(array $university = []): array
    {
        return ['rules' => array_map(
            fn (string $kind) => $kind === 'university'
                ? $university + ['kind' => 'university', 'categories' => ['fruit_tea'], 'price_tiers' => ['budget'], 'note' => 'Students on a budget.']
                : ['kind' => $kind, 'categories' => [], 'price_tiers' => [], 'note' => ''],
            array_keys(AreaRule::kinds())
        )];
    }

    public function test_only_admins_see_the_area_rules(): void
    {
        $rep = User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_USER, 'status' => 1]));

        $this->actingAs($rep)->get(route('recipe.areaRules'))
            ->assertInertia(fn (Assert $page) => $page->component('Errors/CustomError'));
        $this->actingAs($rep)->post(route('recipe.areaRules.update'), $this->rulesPayload());
        $this->assertSame(0, AreaRule::count());
    }

    public function test_the_page_lists_every_area_type_with_its_starting_rule(): void
    {
        (new AreaRuleSeeder())->run();

        $this->actingAs($this->admin)->get(route('recipe.areaRules'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Recipes/AreaRules')
                ->has('rules', count(AreaRule::kinds()))
                ->where('rules.0.kind', 'university')
                ->where('rules.0.label', 'University')
                ->where('rules.0.customers', 'Students')
                ->where('rules.0.categories', ['fruit_tea', 'matcha', 'flavoured_coffee', 'sparkling'])
                ->where('scoring.radius', 1000)
                ->where('scoring.present', 25));
    }

    public function test_an_admin_saves_the_rules_and_the_ranking_reads_them(): void
    {
        $this->actingAs($this->admin)->post(route('recipe.areaRules.update'), $this->rulesPayload())
            ->assertRedirect(route('recipe.areaRules'));

        $rule = AreaRule::where('kind', 'university')->first();
        $this->assertSame(['fruit_tea'], $rule->categories);
        $this->assertSame('Students on a budget.', $rule->note);
        $this->assertSame($this->admin->id, $rule->updated_by);
        $this->assertSame(['categories' => ['fruit_tea'], 'tiers' => ['budget']], AreaRule::forRanking()['university']);
        $this->assertSame(['categories' => [], 'tiers' => []], AreaRule::forRanking()['office']);
    }

    public function test_unknown_kinds_of_drink_or_area_are_refused(): void
    {
        $this->actingAs($this->admin)->post(route('recipe.areaRules.update'), $this->rulesPayload(['categories' => ['beer']]))
            ->assertSessionHasErrors('rules.0.categories.0');

        $payload                    = $this->rulesPayload();
        $payload['rules'][0]['kind'] = 'moon_base';
        $this->actingAs($this->admin)->post(route('recipe.areaRules.update'), $payload)
            ->assertSessionHasErrors('rules.0.kind');

        $this->assertSame(0, AreaRule::count());
    }

    public function test_the_outlet_area_shows_levels_competition_places_and_notes(): void
    {
        (new AreaRuleSeeder())->run();

        $lead = Leads::create([
            'name' => 'Kedai Kopi', 'business_name' => 'Kedai Kopi', 'belong_to' => $this->admin->id, 'assign_to' => $this->admin->id,
            'area_source' => 'amazon', 'area_profiled_at' => now(),
            'area_types' => ['university'], 'nearby_counts' => ['university' => 2, 'shop' => 3, 'cafe' => 4],
            'area_details' => [
                'radius' => 1000, 'weighted' => true,
                'scores' => ['university' => 0.7, 'retail' => 0.25, 'office' => 0.05],
                'evidence' => ['university' => ['count' => 2, 'nearest' => 380], 'retail' => ['count' => 3, 'nearest' => 90], 'office' => ['count' => 1, 'nearest' => 990]],
                'competitors' => ['count' => 4, 'nearest' => 60],
                'places' => [['category' => 'cafe', 'name' => 'Kopi Corner', 'distance' => 60, 'kind' => null]],
            ],
        ]);

        $area = $lead->fresh()->areaProfile();

        $this->assertSame(['university', 'retail'], array_column($area['types'], 'kind'), 'Office is under 10%');
        $this->assertSame(['present', 'present'], array_column($area['types'], 'level'));
        $this->assertSame('Commercial', $area['types'][1]['label']);
        $this->assertSame('Student activity: convenient drinks at accessible prices.', $area['types'][0]['note']);
        $this->assertTrue($area['mixed_use']);
        $this->assertSame(['count' => 4, 'nearest' => 60], $area['competitors']);
        $this->assertSame([['label' => 'Café', 'name' => 'Kopi Corner', 'distance' => 60, 'competitor' => true]], $area['places']);

        $this->assertSame(['university' => 0.7, 'retail' => 0.25], $lead->fresh()->areaForRanking()['shares']);
    }

    public function test_an_outlet_profiled_before_scores_were_kept_gets_them_from_its_counts(): void
    {
        $lead = Leads::create([
            'name' => 'Old Cafe', 'business_name' => 'Old Cafe', 'belong_to' => $this->admin->id, 'assign_to' => $this->admin->id,
            'area_source' => 'seeded', 'area_profiled_at' => now(), 'nearby_counts' => ['office_building' => 6, 'shop' => 4],
        ]);

        $area = $lead->fresh()->areaProfile();

        $this->assertSame(['office', 'retail'], array_column($area['types'], 'kind'));
        $this->assertFalse($area['weighted']);
    }
}
