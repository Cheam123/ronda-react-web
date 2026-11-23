<?php

namespace Database\Seeders;

use App\Models\Leads;
use App\Models\MenuScan;
use App\Models\Recipe;
use App\Models\User;
use App\Services\Menu\MenuScanService;
use Illuminate\Database\Seeder;

/**
 * Demo drinks menus, typed in and confirmed, for about a third of the
 * outlets, so the Drink ideas tab and the drinks list show menus at work.
 *
 * Each menu fits its outlet: the everyday drinks its type serves, a few drinks
 * of the kinds the owner says sell best, now and then something else, and a
 * food line or two that no drink matches. Prices follow the outlet's typical
 * drink price, or its segment.
 *
 * NOT part of DatabaseSeeder. Run it on a development database only:
 *     php artisan db:seed --class=DemoMenusSeeder
 * Deterministic and safe to re-run: an outlet that has a menu is skipped.
 * Run OutletNeedsSeeder first so menus follow the best sellers.
 */
class DemoMenusSeeder extends Seeder
{
    /** Roughly this share of outlets get a menu. */
    private const SHARE = 35;

    /** Outlet type (business_category) => everyday drinks its menu usually has. */
    private const EVERYDAY = [
        1  => ['Americano', 'Espresso'],
        2  => ['Americano', 'Latte', 'Cappuccino', 'Flat White', 'Espresso', 'Piccolo', 'Macchiato'],
        3  => ['Americano', 'Latte', 'Cappuccino', 'Espresso', 'Teh O'],
        4  => ['Americano', 'Latte', 'Teh O'],
        5  => ['Teh O', 'Americano'],
        7  => ['Americano', 'Latte', 'Cappuccino', 'Flat White'],
        14 => ['Teh O', 'Americano', 'Latte'],
    ];

    /** Food a menu might also list; no drink matches it. */
    private const FOOD = ['Nasi Lemak Ayam', 'Croissant', 'Roti Bakar', 'Chicken Sandwich', 'Banana Cake', 'Mee Goreng', 'Kaya Toast', 'Brownie'];

    /** Segment => the middle drink price in RM when the outlet has no typical price. */
    private const PRICES = ['budget' => 6.0, 'mid_range' => 11.0, 'premium' => 16.0];

    public function run(MenuScanService $scans)
    {
        mt_srand(20261120);

        $drinks  = Recipe::active()->get(['id', 'name', 'category', 'everyday']);
        $byKind  = $drinks->where('everyday', false)->groupBy('category');
        $others  = $drinks->where('everyday', false)->pluck('name')->values()->all();
        $known   = $drinks->pluck('name')->all();
        $withMenu = MenuScan::where('status', MenuScan::STATUS_CONFIRMED)->pluck('lead_id')->flip();
        $made    = 0;

        foreach (Leads::query()->orderBy('id')->get() as $lead) {
            // Draw for every outlet, so one outlet's menu doesn't depend on whether another was skipped.
            $chosen = mt_rand(1, 100) <= self::SHARE;
            $lines  = $this->menuFor($lead, $byKind, $others, $known);

            $user = User::find($lead->assign_to ?: $lead->belong_to);
            if (!$chosen || isset($withMenu[$lead->id]) || !$user) {
                continue;
            }

            $scan = $scans->create($lead, $user, MenuScanService::fragmentsFromText(implode("\n", $lines)), MenuScan::SOURCE_TYPED);
            $scans->confirm($scan);
            $made++;
        }

        $this->command?->info("Demo menus typed in for {$made} outlets.");
    }

    /** @return string[] the menu's lines, "Name price" */
    private function menuFor(Leads $lead, $byKind, array $others, array $known): array
    {
        $type   = $lead->business_category !== null ? (int) $lead->business_category : null;
        $middle = (float) ($lead->typical_drink_price ?? self::PRICES[$lead->segment] ?? 10.0);

        $names = array_values(array_intersect(self::EVERYDAY[$type] ?? ['Americano', 'Teh O'], $known));
        shuffle($names);
        $names = array_slice($names, 0, max(1, mt_rand((int) ceil(count($names) / 2), count($names))));

        foreach ($lead->best_selling_kinds ?? [] as $kind) {
            $pool = $byKind->get($kind)?->pluck('name')->all() ?? [];
            shuffle($pool);
            $names = array_merge($names, array_slice($pool, 0, mt_rand(1, 3)));
        }
        if ($others !== [] && mt_rand(1, 100) <= 60) {
            $names[] = $others[mt_rand(0, count($others) - 1)];
        }
        $names = array_values(array_unique($names));

        $lines = array_map(function (string $name) use ($middle) {
            // Iced on some lines, as menus write it; prices around the middle, to the 10 sen.
            $label = mt_rand(1, 100) <= 20 && !str_starts_with($name, 'Iced') ? "Iced {$name}" : $name;
            $price = max(1.5, round($middle * (0.75 + mt_rand(0, 50) / 100), 1));

            return sprintf('%s %s', $label, number_format($price, 2));
        }, $names);

        foreach (array_slice(self::FOOD, mt_rand(0, count(self::FOOD) - 2), mt_rand(0, 2)) as $food) {
            $lines[] = sprintf('%s %s', $food, number_format(round($middle * (0.8 + mt_rand(0, 40) / 100), 1), 2));
        }

        return $lines;
    }
}
