<?php

namespace Tests\Unit;

use App\Services\Menu\MenuIdeas;
use PHPUnit\Framework\TestCase;

/** Which drinks become ideas for a menu, in what order, with which reasons and products. */
class MenuIdeasTest extends TestCase
{
    private const CAFE = 2;

    private function ideas(array $settings = []): MenuIdeas
    {
        return new MenuIdeas($settings + ['limit' => 3, 'min_score' => 0.5], [
            'types'      => [2 => 'Cafe', 14 => 'Kiosk'],
            'groups'     => ['university' => 'Students', 'office' => 'Office workers', 'retail' => 'Shoppers'],
            'tiers'      => ['budget' => 'Budget', 'mid_range' => 'Mid-range', 'premium' => 'Premium'],
            'categories' => ['coffee' => 'Coffee', 'fruit_tea' => 'Fruit tea', 'matcha' => 'Matcha'],
        ]);
    }

    private function ingredient(int $id, string $name, float $price = 10, ?float $typical = 4, bool $active = true): array
    {
        return ['product_id' => $id, 'name' => $name, 'unit' => 'kg', 'unit_price' => $price, 'base_monthly_qty' => $typical, 'amount_label' => '10 g', 'is_active' => $active];
    }

    private function drink(int $id, string $name, array $overrides = []): array
    {
        return $overrides + [
            'id' => $id, 'slug' => strtolower(str_replace(' ', '-', $name)), 'name' => $name, 'serve' => 'iced', 'category' => 'coffee',
            'description' => null, 'outlet_types' => [self::CAFE], 'customer_groups' => ['university'], 'price_tier' => 'mid_range',
            'is_active' => true, 'is_halal' => true, 'cost_per_serve' => 2.5,
            'ingredients' => [$this->ingredient(1, 'Espresso Blend'), $this->ingredient(2, 'Full Cream Milk')],
        ];
    }

    private function outlet(array $overrides = []): array
    {
        return $overrides + ['type' => self::CAFE, 'customers' => ['university'], 'halal_only' => false, 'seats' => 50, 'segment' => null];
    }

    /** A cafe menu with two coffees, mid-range prices. */
    private function menu(array $overrides = []): array
    {
        return $overrides + ['on_menu' => [1, 2], 'price_level' => 'mid_range'];
    }

    private function catalogue(): array
    {
        return [
            $this->drink(1, 'Latte'),
            $this->drink(2, 'Cappuccino'),
            $this->drink(3, 'Vanilla Latte', ['ingredients' => [$this->ingredient(1, 'Espresso Blend'), $this->ingredient(2, 'Full Cream Milk'), $this->ingredient(3, 'Vanilla Syrup', 30, 3)]]),
            $this->drink(4, 'Peach Tea', ['category' => 'fruit_tea', 'ingredients' => [$this->ingredient(4, 'Green Tea'), $this->ingredient(5, 'Peach Syrup', 30, 3)]]),
            $this->drink(5, 'Matcha Latte', ['category' => 'matcha', 'ingredients' => [$this->ingredient(6, 'Matcha Powder', 60, 1), $this->ingredient(2, 'Full Cream Milk')]]),
        ];
    }

    public function test_drinks_already_on_the_menu_are_never_ideas(): void
    {
        $names = array_column($this->ideas()->rank($this->outlet(), $this->menu(), $this->catalogue()), 'name');

        $this->assertNotContains('Latte', $names);
        $this->assertNotContains('Cappuccino', $names);
        $this->assertCount(3, $names);
    }

    public function test_the_score_is_the_average_of_the_known_parts(): void
    {
        $idea = collect($this->ideas()->rank($this->outlet(), $this->menu(), $this->catalogue()))->firstWhere('name', 'Vanilla Latte');

        // Type 1, customers 1, price 1, easy 2 of 3 ingredients, new: 2 coffees already, so half.
        $this->assertSame(['type' => 1.0, 'customers' => 1.0, 'price' => 1.0, 'easy' => 0.667, 'new' => 0.5], $idea['parts']);
        $this->assertSame(0.833, $idea['score']);
    }

    public function test_a_kind_the_menu_lacks_is_a_reason_and_scores_full(): void
    {
        $idea = collect($this->ideas()->rank($this->outlet(), $this->menu(), $this->catalogue()))->firstWhere('name', 'Peach Tea');

        $this->assertSame(1.0, $idea['parts']['new']);
        $this->assertSame(0.0, $idea['parts']['easy']);
        $this->assertContains('Their menu has no fruit tea yet', $idea['reasons']);
        $this->assertContains('Suits a Cafe', $idea['reasons']);
        $this->assertContains('For their customers: Students', $idea['reasons']);
        $this->assertContains('Fits their mid-range prices', $idea['reasons']);
    }

    public function test_shared_ingredients_are_named_as_a_reason(): void
    {
        $idea = collect($this->ideas()->rank($this->outlet(), $this->menu(), $this->catalogue()))->firstWhere('name', 'Matcha Latte');

        $this->assertContains('Uses full cream milk, which their menu already needs', $idea['reasons']);
    }

    public function test_unknown_parts_are_left_out_not_counted_as_a_miss(): void
    {
        // No type, no customers, no prices read and no segment: only what the menu itself shows is left.
        $outlet = $this->outlet(['type' => null, 'customers' => []]);
        $idea   = collect($this->ideas()->rank($outlet, $this->menu(['price_level' => null]), $this->catalogue()))->firstWhere('name', 'Vanilla Latte');

        $this->assertSame(['easy', 'new'], array_keys($idea['parts']));
    }

    public function test_the_outlets_segment_stands_in_when_the_menu_had_no_prices(): void
    {
        $outlet = $this->outlet(['segment' => 'premium']);
        $idea   = collect($this->ideas()->rank($outlet, $this->menu(['price_level' => null]), $this->catalogue()))->firstWhere('name', 'Vanilla Latte');

        $this->assertSame(0.5, $idea['parts']['price'], 'mid-range against premium is one step apart');
    }

    public function test_halal_only_outlets_never_get_a_drink_that_is_not_halal(): void
    {
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(6, 'Rum Latte', ['is_halal' => false]);

        $this->assertContains('Rum Latte', array_column($this->ideas(['limit' => 10])->rank($this->outlet(), $this->menu(), $drinks), 'name'));
        $this->assertNotContains('Rum Latte', array_column($this->ideas(['limit' => 10])->rank($this->outlet(['halal_only' => true]), $this->menu(), $drinks), 'name'));
    }

    public function test_declined_inactive_and_unmakeable_drinks_are_left_out(): void
    {
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(6, 'Retired Drink', ['is_active' => false]);
        $drinks[] = $this->drink(7, 'Out Of Stock Drink', ['ingredients' => [$this->ingredient(9, 'Gone Syrup', 30, 3, false)]]);

        $names = array_column($this->ideas(['limit' => 10])->rank($this->outlet(), $this->menu(), $drinks, declined: [3]), 'name');

        $this->assertSame(['Matcha Latte', 'Peach Tea'], $names);
    }

    public function test_a_poor_fit_is_not_shown(): void
    {
        // A budget kiosk drink for office workers, with nothing in common with this menu's ingredients.
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(8, 'Wrong Drink', [
            'outlet_types' => [14], 'customer_groups' => ['office'], 'price_tier' => 'premium',
            'ingredients'  => [$this->ingredient(20, 'Something Else')],
        ]);

        $this->assertNotContains('Wrong Drink', array_column($this->ideas(['limit' => 10])->rank($this->outlet(), $this->menu(), $drinks), 'name'));
    }

    public function test_quantities_follow_the_outlets_seats_within_half_and_double(): void
    {
        $quantity = fn (?int $seats) => collect($this->ideas()->rank($this->outlet(['seats' => $seats]), $this->menu(), $this->catalogue()))
            ->firstWhere('name', 'Vanilla Latte')['products'][0]['quantity'];

        $this->assertSame(4.0, $quantity(50), 'the typical quantity at 50 seats');
        $this->assertSame(8.0, $quantity(400), 'never above double');
        $this->assertSame(2.0, $quantity(5), 'never below half');
        $this->assertSame(4.0, $quantity(null), 'seats not known');
    }

    public function test_products_already_bought_are_marked_and_left_out_of_the_value(): void
    {
        $idea = collect($this->ideas()->rank($this->outlet(), $this->menu(), $this->catalogue(), bought: [1, 2]))->firstWhere('name', 'Vanilla Latte');

        $this->assertSame([true, true, false], array_column($idea['products'], 'already_buys'));
        // Only the vanilla syrup is new: 3 bottles at RM 30.
        $this->assertSame(90.0, $idea['est_monthly_value']);
    }

    public function test_the_same_score_goes_by_name_and_the_limit_is_kept(): void
    {
        $drinks = [
            $this->drink(1, 'Latte'),
            $this->drink(11, 'Zebra Latte'),
            $this->drink(12, 'Apple Latte'),
            $this->drink(13, 'Mango Latte'),
        ];

        $this->assertSame(
            ['Apple Latte', 'Mango Latte'],
            array_column($this->ideas(['limit' => 2])->rank($this->outlet(), $this->menu(['on_menu' => [1]]), $drinks), 'name')
        );
    }

    public function test_with_nothing_recognised_on_the_menu_only_the_outlet_decides(): void
    {
        $idea = $this->ideas()->rank($this->outlet(), $this->menu(['on_menu' => []]), $this->catalogue())[0];

        $this->assertSame(['type', 'customers', 'price'], array_keys($idea['parts']));
    }

    /** Students make up 60% of the places nearby, office workers 40%. */
    private function campusArea(): array
    {
        return [
            'shares'   => ['university' => 0.6, 'office' => 0.4],
            'evidence' => ['university' => ['count' => 3, 'nearest' => 400], 'office' => ['count' => 5, 'nearest' => 650]],
            'radius'   => 1000,
        ];
    }

    private function areaSettings(): array
    {
        return [
            'weights'    => ['area' => 2],
            'area_rules' => ['university' => ['categories' => ['fruit_tea', 'matcha'], 'tiers' => ['budget', 'mid_range']]],
        ];
    }

    public function test_the_area_part_is_the_fit_averaged_by_share_and_counts_double(): void
    {
        $outlet = $this->outlet(['customers' => [], 'area' => $this->campusArea()]);
        $idea   = collect($this->ideas($this->areaSettings())->rank($outlet, $this->menu(), $this->catalogue()))->firstWhere('name', 'Peach Tea');

        // University: students, fruit tea and mid-range all match (1). Office: no rule, and Peach Tea isn't for office workers (0).
        $this->assertSame(0.6, $idea['parts']['area']);
        $this->assertArrayNotHasKey('customers', $idea['parts'], 'The rep named no customers');
        // Type 1, area 0.6 counted twice, price 1, easy 0, new 1: 4.2 / 6.
        $this->assertSame(0.7, $idea['score']);
        $this->assertContains('Students nearby: 3 places within 1 km, the nearest 400 m away', $idea['reasons']);
    }

    public function test_a_kind_the_area_rule_doesnt_name_fits_less(): void
    {
        $outlet = $this->outlet(['customers' => [], 'area' => $this->campusArea()]);
        $ideas  = collect($this->ideas($this->areaSettings() + ['min_score' => 0])->rank($outlet, $this->menu(), $this->catalogue()));

        // Vanilla Latte is for students and mid-range, but coffee isn't a kind the university rule names: 2 of 3.
        $this->assertSame(0.4, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['area']);
        $this->assertSame(0.6, $ideas->firstWhere('name', 'Peach Tea')['parts']['area']);
    }

    public function test_the_reps_customers_and_the_area_both_count(): void
    {
        $outlet = $this->outlet(['customers' => ['office'], 'area' => ['shares' => ['university' => 1.0], 'evidence' => [], 'radius' => null]]);
        $idea   = collect($this->ideas()->rank($outlet, $this->menu(), $this->catalogue()))->firstWhere('name', 'Peach Tea');

        $this->assertArrayHasKey('customers', $idea['parts']);
        $this->assertSame(1.0, $idea['parts']['area'], 'No rule for the area, so only its customers are checked');
        $this->assertContains('Students nearby', $idea['reasons'], 'No evidence, so no counts');
    }

    public function test_a_drink_tagged_for_no_one_fits_any_area(): void
    {
        $drinks = [$this->drink(1, 'Latte'), $this->drink(9, 'House Soda', ['category' => 'sparkling', 'customer_groups' => [], 'price_tier' => null])];
        $outlet = $this->outlet(['customers' => [], 'area' => ['shares' => ['office' => 1.0], 'evidence' => [], 'radius' => null]]);

        $idea = $this->ideas()->rank($outlet, $this->menu(['on_menu' => [1]]), $drinks)[0];

        $this->assertSame('House Soda', $idea['name']);
        $this->assertSame(1.0, $idea['parts']['area']);
    }

    // What the owner told the rep: best sellers, goals and the typical drink price.

    /** Every idea, scored, with no limit or lowest score, and needs counting double. */
    private function allIdeas(array $outlet, array $menu, array $drinks = [], array $bought = []): \Illuminate\Support\Collection
    {
        return collect($this->ideas(['limit' => 20, 'min_score' => 0, 'weights' => ['needs' => 2]])->rank($outlet, $menu, $drinks ?: $this->catalogue(), bought: $bought));
    }

    private function noMenu(): array
    {
        return ['on_menu' => [], 'price_level' => null];
    }

    public function test_a_typical_drink_price_gives_the_price_level_before_the_segment(): void
    {
        $this->assertSame('budget', MenuIdeas::priceLevel(7.9));
        $this->assertSame('mid_range', MenuIdeas::priceLevel(8.0));
        $this->assertSame('mid_range', MenuIdeas::priceLevel(14.0));
        $this->assertSame('premium', MenuIdeas::priceLevel(14.5));
        $this->assertNull(MenuIdeas::priceLevel(null));

        $outlet = $this->outlet(['segment' => 'budget', 'typical_price' => 16.0]);
        $price  = fn (array $menu) => $this->allIdeas($outlet, $menu)->firstWhere('name', 'Vanilla Latte')['parts']['price'];

        $this->assertSame(0.5, $price($this->menu(['price_level' => null])), 'RM 16 is premium: one step from mid-range');
        $this->assertSame(1.0, $price($this->menu()), 'prices read from the menu come first');
    }

    public function test_with_no_menu_the_needs_still_give_ideas_and_their_reasons_come_first(): void
    {
        $outlet = $this->outlet(['best_sellers' => ['fruit_tea']]);
        $ideas  = $this->allIdeas($outlet, $this->noMenu());

        $peach = $ideas->first();
        $this->assertSame('Peach Tea', $peach['name']);
        $this->assertSame(['type' => 1.0, 'customers' => 1.0, 'needs' => 1.0], $peach['parts']);
        $this->assertSame('Like their best sellers: fruit tea', $peach['reasons'][0]);

        // Type 1, customers 1, needs 0 counted twice: 2 / 4.
        $this->assertSame(0.5, $ideas->firstWhere('name', 'Latte')['score']);
    }

    public function test_a_goal_that_cant_be_judged_leaves_the_needs_out(): void
    {
        // Spend can't be judged with no price level at all.
        $idea = $this->allIdeas($this->outlet(['goals' => ['average_spend']]), $this->noMenu())->first();

        $this->assertArrayNotHasKey('needs', $idea['parts']);
    }

    public function test_a_wider_menu_wants_kinds_they_dont_sell_and_leaves_best_sellers_to_the_goal(): void
    {
        $outlet = $this->outlet(['best_sellers' => ['coffee'], 'goals' => ['expand_menu']]);

        $ideas = $this->allIdeas($outlet, $this->noMenu());
        $this->assertSame(0.0, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['needs']);
        $this->assertNotContains('Like their best sellers: coffee', $ideas->firstWhere('name', 'Vanilla Latte')['reasons']);
        $this->assertSame(1.0, $ideas->firstWhere('name', 'Peach Tea')['parts']['needs']);
        $this->assertContains('Different from their best sellers, to widen the menu', $ideas->firstWhere('name', 'Peach Tea')['reasons']);

        // With a menu of two coffees, what the menu lacks decides, and the new part already says so.
        $peach = $this->allIdeas($outlet, $this->menu())->firstWhere('name', 'Peach Tea');
        $this->assertSame(1.0, $peach['parts']['needs']);
        $this->assertNotContains('Different from their best sellers, to widen the menu', $peach['reasons']);
        $this->assertContains('Their menu has no fruit tea yet', $peach['reasons']);
    }

    public function test_new_customers_are_the_areas_groups_the_outlet_doesnt_serve_yet(): void
    {
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(6, 'Office Brew', ['customer_groups' => ['office', 'university']]);
        $outlet   = $this->outlet(['customers' => ['university'], 'area' => $this->campusArea(), 'goals' => ['new_customers']]);

        $ideas = $this->allIdeas($outlet, $this->noMenu(), $drinks);

        $brew = $ideas->firstWhere('name', 'Office Brew');
        $this->assertSame(1.0, $brew['parts']['needs']);
        $this->assertSame('Could bring in office workers from nearby', $brew['reasons'][0]);
        $this->assertSame(0.0, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['needs'], 'only for students, who already come');
    }

    public function test_a_higher_spend_wants_one_price_level_up(): void
    {
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(6, 'Gold Latte', ['price_tier' => 'premium']);
        $drinks[] = $this->drink(7, 'Kopi O', ['price_tier' => 'budget']);
        $outlet   = $this->outlet(['goals' => ['average_spend']]);

        $ideas = $this->allIdeas($outlet, $this->menu(), $drinks);
        $this->assertSame(1.0, $ideas->firstWhere('name', 'Gold Latte')['parts']['needs']);
        $this->assertContains('A step up from their mid-range prices, to raise spend', $ideas->firstWhere('name', 'Gold Latte')['reasons']);
        $this->assertSame(0.5, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['needs']);
        $this->assertSame(0.0, $ideas->firstWhere('name', 'Kopi O')['parts']['needs']);

        // Nothing is above premium, so premium keeps spend up there.
        $premium = $this->allIdeas($outlet, $this->menu(['price_level' => 'premium']), $drinks);
        $this->assertSame(1.0, $premium->firstWhere('name', 'Gold Latte')['parts']['needs']);
    }

    public function test_a_lower_cost_wants_products_they_already_order_and_cheap_drinks(): void
    {
        $drinks = array_map(fn (array $drink) => ['cost_per_serve' => match ($drink['name']) {
            'Peach Tea'     => 1.0,
            'Matcha Latte'  => 2.0,
            'Vanilla Latte' => 3.0,
            default         => 2.5,
        }] + $drink, $this->catalogue());
        $outlet = $this->outlet(['goals' => ['ingredient_cost']]);

        // They order matcha powder (product 6). Costs run from RM 1 to RM 3 a cup.
        $ideas = $this->allIdeas($outlet, $this->noMenu(), $drinks, bought: [6]);

        $peach = $ideas->firstWhere('name', 'Peach Tea');
        $this->assertSame(0.5, $peach['parts']['needs'], 'nothing they order, but the cheapest');
        $this->assertContains('One of the cheapest drinks to make', $peach['reasons']);

        $matcha = $ideas->firstWhere('name', 'Matcha Latte');
        $this->assertSame(0.5, $matcha['parts']['needs'], 'half its products ordered, halfway on cost');
        $this->assertContains('Uses matcha powder, which they already order', $matcha['reasons']);

        $this->assertSame(0.0, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['needs'], 'nothing ordered, and the dearest');
    }

    public function test_improving_drinks_wants_the_kinds_that_sell_most_or_are_on_the_menu(): void
    {
        $ideas = $this->allIdeas($this->outlet(['best_sellers' => ['matcha'], 'goals' => ['improve_drinks']]), $this->noMenu());

        $matcha = $ideas->firstWhere('name', 'Matcha Latte');
        $this->assertSame(1.0, $matcha['parts']['needs']);
        $this->assertSame(['A better take on the matcha they sell most'], array_slice($matcha['reasons'], 0, 1));
        $this->assertNotContains('Like their best sellers: matcha', $matcha['reasons'], 'the goal already counts it');
        $this->assertSame(0.0, $ideas->firstWhere('name', 'Peach Tea')['parts']['needs']);

        // No best sellers given: the kinds on their menu stand in.
        $ideas = $this->allIdeas($this->outlet(['goals' => ['improve_drinks']]), $this->menu());
        $this->assertSame(1.0, $ideas->firstWhere('name', 'Vanilla Latte')['parts']['needs']);
        $this->assertContains('Builds on the coffee on their menu', $ideas->firstWhere('name', 'Vanilla Latte')['reasons']);
        $this->assertSame(0.0, $ideas->firstWhere('name', 'Peach Tea')['parts']['needs']);
    }

    public function test_an_everyday_drink_is_an_idea_only_when_a_menu_lacks_it(): void
    {
        $drinks   = $this->catalogue();
        $drinks[] = $this->drink(6, 'Americano', ['everyday' => true]);

        $this->assertNotContains('Americano', $this->allIdeas($this->outlet(), $this->noMenu(), $drinks)->pluck('name'), 'they very likely serve one already');
        $this->assertContains('Americano', $this->allIdeas($this->outlet(), $this->menu(), $drinks)->pluck('name'), 'the menu shows it is missing');
        $this->assertNotContains('Americano', $this->allIdeas($this->outlet(), $this->menu(['on_menu' => [1, 2, 6]]), $drinks)->pluck('name'));
    }

    public function test_reasons_come_strongest_first_and_the_outlet_type_last(): void
    {
        $outlet = $this->outlet(['best_sellers' => ['fruit_tea'], 'area' => $this->campusArea()]);
        $peach  = $this->allIdeas($outlet, $this->menu())->firstWhere('name', 'Peach Tea');

        $this->assertSame([
            'Like their best sellers: fruit tea',
            'For their customers: Students',
            'Students nearby: 3 places within 1 km, the nearest 400 m away',
            'Their menu has no fruit tea yet',
            'Fits their mid-range prices',
            'Suits a Cafe',
        ], $peach['reasons']);
    }

    public function test_the_needs_checks_are_averaged(): void
    {
        // Matcha sells best, and they want a step up in spend: Matcha Latte meets the first, not the second (same level).
        $outlet = $this->outlet(['best_sellers' => ['matcha'], 'goals' => ['average_spend']]);
        $matcha = $this->allIdeas($outlet, $this->menu())->firstWhere('name', 'Matcha Latte');

        $this->assertSame(0.75, $matcha['parts']['needs']);
    }
}
