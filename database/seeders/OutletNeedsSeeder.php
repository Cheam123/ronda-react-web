<?php

namespace Database\Seeders;

use App\Models\Leads;
use App\Models\Recipe;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo answers for "What the outlet needs", so drink ideas on a demo database
 * use them: main customers, best-selling drinks, goals and the typical drink
 * price, made up to fit each outlet's type, segment and area.
 *
 * About one outlet in five is left blank, and any one answer is sometimes
 * missing, as when a rep didn't ask. An outlet that already has any answer
 * is never touched, so a rep's own answers stay.
 *
 * NOT part of DatabaseSeeder. Run it on a development database only:
 *     php artisan db:seed --class=OutletNeedsSeeder
 * Deterministic (fixed random seed) and safe to re-run. It writes the columns
 * directly, so outlets keep their "last updated" dates.
 */
class OutletNeedsSeeder extends Seeder
{
    /** Outlet type (business_category) => drink kinds that tend to sell best there, most likely first. */
    private const SELLERS = [
        1  => ['sparkling', 'coffee', 'fruit_tea'],                // bar
        2  => ['coffee', 'flavoured_coffee', 'matcha', 'chocolate'], // cafe
        3  => ['coffee', 'tea', 'sparkling'],                      // hotel
        4  => ['coffee', 'tea', 'kopitiam'],                       // office pantry
        5  => ['kopitiam', 'tea', 'fruit_tea', 'coffee'],          // restaurant
        7  => ['coffee', 'chocolate', 'tea'],                      // bakery
        14 => ['kopitiam', 'fruit_tea', 'coffee', 'chocolate'],    // kiosk
    ];

    /** Outlet type => who it serves when nothing is known about its area. */
    private const CUSTOMERS = [
        1  => ['residential', 'tourist'],
        2  => ['university', 'office'],
        3  => ['tourist'],
        4  => ['office'],
        5  => ['residential', 'office'],
        7  => ['residential', 'retail'],
        14 => ['transit', 'office'],
    ];

    /** Segment => goals an owner at that level tends to name, most likely first. */
    private const GOALS = [
        'budget'    => ['ingredient_cost', 'new_customers', 'expand_menu', 'average_spend'],
        'mid_range' => ['new_customers', 'expand_menu', 'average_spend', 'improve_drinks', 'ingredient_cost'],
        'premium'   => ['improve_drinks', 'expand_menu', 'average_spend', 'new_customers'],
    ];

    /** Segment => the typical drink price range in RM, from the menu price levels. */
    private const PRICES = [
        'budget'    => [4.5, 7.5],
        'mid_range' => [8.5, 13.5],
        'premium'   => [14.5, 20.0],
    ];

    public function run()
    {
        mt_srand(20261119);

        $groups = array_keys((array) config('ife.recommendation.customer_groups', []));
        $kinds  = array_keys(Recipe::CATEGORIES);
        $goals  = array_keys(Leads::GOALS);
        $filled = 0;

        Leads::query()->orderBy('id')->chunkById(100, function ($leads) use ($groups, $kinds, $goals, &$filled) {
            foreach ($leads as $lead) {
                // Draw for every outlet, so one outlet's answers don't depend on whether another was skipped.
                $answers = $this->answersFor($lead, $groups, $kinds, $goals);

                $hasAny = $lead->main_customers || $lead->best_selling_kinds || $lead->improvement_goals || $lead->typical_drink_price !== null;
                if ($hasAny || $answers === null) {
                    continue;
                }

                DB::table('leads')->where('id', $lead->id)->update(array_map(
                    fn ($value) => is_array($value) ? json_encode($value) : $value,
                    $answers
                ));
                $filled++;
            }
        });

        $this->command?->info("Demo needs filled on {$filled} outlets.");
    }

    /**
     * One outlet's made-up answers, or null to leave it blank.
     *
     * @return array{main_customers: ?string[], best_selling_kinds: ?string[], improvement_goals: ?string[], typical_drink_price: ?float}|null
     */
    private function answersFor(Leads $lead, array $groups, array $kinds, array $goals): ?array
    {
        $blank    = $this->chance(20);
        $type     = $lead->business_category !== null ? (int) $lead->business_category : null;
        $segment  = $lead->segment;

        // Main customers: the strongest one or two groups around it, now and then one more the type suggests.
        $shares = $lead->areaForRanking()['shares'];
        arsort($shares);
        $customers = array_slice(array_keys($shares), 0, mt_rand(1, 2));
        $byType    = self::CUSTOMERS[$type] ?? ['residential'];
        if ($customers === [] || $this->chance(30)) {
            $customers[] = $byType[mt_rand(0, count($byType) - 1)];
        }
        $customers = array_values(array_intersect(array_unique($customers), $groups));

        $sellers = $this->pick(self::SELLERS[$type] ?? ['coffee', 'tea'], mt_rand(1, 2));
        $wants   = $this->pick(self::GOALS[$segment] ?? $goals, mt_rand(1, 2));

        [$low, $high] = self::PRICES[$segment] ?? [7.0, 13.0];
        $price        = round(($low + (mt_rand() / mt_getrandmax()) * ($high - $low)) * 2) / 2;

        // Each answer is sometimes missing.
        $missing = fn () => $this->chance(10);
        $answers = [
            'main_customers'      => $missing() || $customers === [] ? null : $customers,
            'best_selling_kinds'  => $missing() ? null : array_values(array_intersect($sellers, $kinds)),
            'improvement_goals'   => $missing() ? null : array_values(array_intersect($wants, $goals)),
            'typical_drink_price' => $missing() ? null : $price,
        ];

        return $blank ? null : $answers;
    }

    /**
     * $count different items, the earlier ones more likely.
     *
     * @return string[]
     */
    private function pick(array $items, int $count): array
    {
        $picked = [];
        while (count($picked) < min($count, count($items))) {
            // Weights 4, 3, 2, 1… for the items in order.
            $weights = [];
            foreach ($items as $i => $item) {
                if (!in_array($item, $picked, true)) {
                    $weights[$item] = max(1, 4 - $i);
                }
            }
            $roll = mt_rand(1, array_sum($weights));
            foreach ($weights as $item => $weight) {
                if (($roll -= $weight) <= 0) {
                    $picked[] = $item;
                    break;
                }
            }
        }

        return $picked;
    }

    private function chance(int $percent): bool
    {
        return mt_rand(1, 100) <= $percent;
    }
}
