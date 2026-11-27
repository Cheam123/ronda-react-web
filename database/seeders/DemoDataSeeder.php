<?php

namespace Database\Seeders;

use App\Models\IFEReport;
use App\Models\IfeArea;
use App\Models\Leads;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Demo data for trying the dashboard and the outlet screens: a small
 * product catalogue, a manager and three
 * Field Reps, two dozen outlets with profiles, five months of orders, visits
 * and tasks in every risk state.
 *
 * NOT part of DatabaseSeeder. Run it on a development database only:
 *     php artisan db:seed --class=DemoDataSeeder
 * Demo logins: manager@demo.test / rep1@demo.test .. rep3@demo.test,
 * password 12345678.
 *
 * Deterministic (fixed random seed) and safe to re-run: products and users
 * are matched by SKU / email, and outlets it created before are skipped.
 */
class DemoDataSeeder extends Seeder
{
    private const PASSWORD = '12345678';

    public function run()
    {
        mt_srand(20260928);

        $this->call(IfeAreaSeeder::class);

        DB::transaction(function () {
            $products = $this->products();
            [$manager, $reps] = $this->people();

            if (Leads::where('remark', 'like', '[demo]%')->exists()) {
                $this->command?->warn('Demo outlets already exist; skipping outlets, orders, visits and tasks.');
                return;
            }

            $outlets = $this->outlets($reps, $manager);
            $this->orders($outlets, $products);
            $this->visits($outlets);
            $this->tasks($outlets, $manager);
        });

        // Drinks the demo catalogue can make, the area types they suit, and what the outlets need. Safe to re-run.
        $this->call(RecipeSeeder::class);
        $this->call(AreaRuleSeeder::class);
        $this->call(OutletNeedsSeeder::class);

        $this->command?->info('Demo data ready. Run "php artisan digest:daily" next.');
    }

    /** @return array<string, Product> sku => product */
    private function products(): array
    {
        $catalogue = [
            // sku, name, category, unit, price
            ['BEAN-HOUSE-1K', 'House Espresso Blend',          'Coffee Beans',   'kg',     75.00],
            ['BEAN-ETH-1K',   'Single Origin Ethiopia',        'Coffee Beans',   'kg',    110.00],
            ['BEAN-DECAF-1K', 'Decaf Blend',                   'Coffee Beans',   'kg',     85.00],
            ['BEAN-COLD-1K',  'Cold Brew Coarse Grind',        'Coffee Beans',   'kg',     70.00],
            ['MILK-FULL-1L',  'Full Cream Milk',               'Dairy & Alt',    'litre',   7.50],
            ['MILK-OAT-1L',   'Oat Milk Barista Edition',      'Dairy & Alt',    'litre',  14.00],
            ['CREAM-WHIP-1L', 'Whipping Cream',                'Dairy & Alt',    'litre',  22.00],
            ['SYR-VAN-750',   'Vanilla Syrup',                 'Syrups',         'bottle', 32.00],
            ['SYR-CAR-750',   'Caramel Syrup',                 'Syrups',         'bottle', 32.00],
            ['SYR-HAZ-750',   'Hazelnut Syrup',                'Syrups',         'bottle', 32.00],
            ['PWD-MATCHA-500','Matcha Powder',                 'Tea & Powders',  'pack',   95.00],
            ['PWD-CHOC-1K',   'Chocolate Powder',              'Tea & Powders',  'kg',     45.00],
            ['TEA-CHAI-1L',   'Chai Concentrate',              'Tea & Powders',  'litre',  38.00],
            ['CUP-12OZ-1000', '12oz Paper Cups (1,000)',       'Consumables',    'box',   180.00],
            ['LID-12OZ-1000', '12oz Cup Lids (1,000)',         'Consumables',    'box',    90.00],
            ['CLEAN-TAB',     'Espresso Machine Cleaning Tabs','Consumables',    'tub',    65.00],
        ];

        $products = [];
        foreach ($catalogue as [$sku, $name, $category, $unit, $price]) {
            $products[$sku] = Product::firstOrCreate(
                ['sku' => $sku],
                ['name' => $name, 'category' => $category, 'unit' => $unit, 'unit_price' => $price, 'is_active' => true]
            );
        }

        return $products;
    }

    /** @return array{0: User, 1: User[]} */
    private function people(): array
    {
        $make = fn (string $email, string $name, int $type, string $gender, string $mobile) => User::withoutEvents(
            fn () => User::firstOrCreate(['email' => $email], [
                'name'     => $name,
                'type'     => $type,
                'status'   => 1,
                'gender'   => $gender,
                'mobile'   => $mobile,
                'password' => Hash::make(self::PASSWORD),
            ])
        );

        $manager = $make('manager@demo.test', 'Mei Ling Tan', User::TYPE_MANAGER, 'F', '60120000001');
        $reps    = [
            $make('rep1@demo.test', 'Aiman Rahman', User::TYPE_USER, 'M', '60120000002'),
            $make('rep2@demo.test', 'Priya Nair',   User::TYPE_USER, 'F', '60120000003'),
            $make('rep3@demo.test', 'Jason Lim',    User::TYPE_USER, 'M', '60120000004'),
        ];

        foreach (array_merge([$manager], $reps) as $user) {
            if (!$user->username) {
                $user->username = sprintf('U%05d', $user->id);
                $user->save();
            }
        }

        return [$manager, $reps];
    }

    /**
     * Outlets: business_category (1 bar, 2 cafe, 3 hotel, 4 office,
     * 5 restaurant, 7 bakery, 14 kiosk), segment, size, seats, and whether
     * they already buy (customer_id set) or are prospects.
     */
    private function outlets(array $reps, User $manager): array
    {
        $areas = IfeArea::orderBy('id')->pluck('id')->all();

        $rows = [
            // name, shop, category, segment, size, seats, customer?
            ['Kopi Kita Sdn Bhd',        'Kopi Kita Bangsar',       2, 'mid_range', 'small',  24, true],
            ['Brew Lab Enterprise',      'Brew Lab TTDI',           2, 'premium',   'medium', 48, true],
            ['Roast & Co',               'Roast & Co Damansara',    2, 'premium',   'medium', 55, true],
            ['Daily Grind Cafe',         'Daily Grind SS2',         2, 'mid_range', 'small',  30, true],
            ['Morning Ritual',           'Morning Ritual Subang',   2, 'premium',   'small',  28, true],
            ['Cafe Senja',               'Cafe Senja Shah Alam',    2, 'budget',    'small',  20, true],
            ['Bean There Cafe',          'Bean There Puchong',      2, 'mid_range', 'medium', 45, false],
            ['Artisan Loft',             'Artisan Loft Mont Kiara', 2, 'premium',   'large',  90, false],
            ['Rasa Kitchen',             'Rasa Kitchen PJ',         5, 'mid_range', 'large', 120, true],
            ['Nasi & Co',                'Nasi & Co Cheras',        5, 'budget',    'medium', 60, true],
            ['The Olive Table',          'The Olive Table KLCC',    5, 'premium',   'large', 110, true],
            ['Spice Route Bistro',       'Spice Route Ampang',      5, 'mid_range', 'medium', 70, false],
            ['Golden Crust Bakery',      'Golden Crust SS15',       7, 'mid_range', 'small',  16, true],
            ['Butter & Bloom',           'Butter & Bloom Bangsar',  7, 'premium',   'small',  22, true],
            ['Roti Harian',              'Roti Harian Klang',       7, 'budget',    'small',  12, true],
            ['Sweet Crumbs',             'Sweet Crumbs Penang',     7, 'mid_range', 'small',  18, false],
            ['Grand Palm Hotel',         'Grand Palm Lobby Lounge', 3, 'premium',   'large', 150, true],
            ['Seri Bay Hotel',           'Seri Bay Coffee House',   3, 'mid_range', 'large', 100, true],
            ['Tower One Pantry',         'Tower One Level 12',      4, 'mid_range', 'medium', 40, true],
            ['GoCup Kiosk',              'GoCup Mid Valley',       14, 'budget',    'small',   0, true],
            ['Quick Shot Coffee',        'Quick Shot LRT Kelana',  14, 'budget',    'small',   0, true],
            ['Kiosk Kopi Pagi',          'Kopi Pagi Sentral',      14, 'budget',    'small',   0, false],
            ['Hops & Barrel',            'Hops & Barrel Changkat',  1, 'premium',   'medium', 60, true],
            ['Night Owl Bar',            'Night Owl Penang',        1, 'mid_range', 'small',  35, false],
        ];

        $outlets = [];
        foreach ($rows as $i => [$name, $shop, $category, $segment, $size, $seats, $customer]) {
            $rep  = $reps[$i % count($reps)];
            $lead = new Leads([
                'name'              => $name,
                'business_name'     => $shop,
                'customer_id'       => $customer ? sprintf('C%05d', 1001 + $i) : null,
                'receiving_date'    => Carbon::today()->subMonths(8)->toDateString(),
                'belong_to'         => $rep->id,
                'assign_to'         => $rep->id,
                'business_category' => $category,
                'source'            => 99,
                'mobile'            => sprintf('6011%07d', 2000000 + $i),
                'ife_area_id'       => $areas ? $areas[$i % count($areas)] : null,
                'size_band'         => $size,
                'seats'             => $seats ?: null,
                'segment'           => $segment,
                'latitude'          => round(3.05 + mt_rand(0, 2000) / 10000, 7),
                'longitude'         => round(101.55 + mt_rand(0, 2500) / 10000, 7),
                'location_accuracy' => mt_rand(5, 25),
                'remark'            => '[demo] seeded outlet',
            ]);
            $lead->location_captured_at = Carbon::now()->subDays(mt_rand(10, 60));
            $lead->save();

            $outlets[] = ['lead' => $lead, 'rep' => $rep, 'customer' => $customer, 'category' => $category, 'segment' => $segment, 'seats' => $seats];
        }

        return $outlets;
    }

    /**
     * Five months of monthly orders for the customers. Each kind of outlet
     * has a typical basket; a few items are randomly left out per outlet.
     */
    private function orders(array $outlets, array $products): void
    {
        $baskets = [
            2  => ['BEAN-HOUSE-1K' => 8, 'MILK-FULL-1L' => 40, 'SYR-VAN-750' => 3, 'SYR-CAR-750' => 3, 'CUP-12OZ-1000' => 1, 'LID-12OZ-1000' => 1, 'CLEAN-TAB' => 1],
            5  => ['BEAN-HOUSE-1K' => 6, 'BEAN-DECAF-1K' => 2, 'MILK-FULL-1L' => 30, 'CREAM-WHIP-1L' => 6, 'CLEAN-TAB' => 1],
            7  => ['BEAN-HOUSE-1K' => 3, 'MILK-FULL-1L' => 20, 'PWD-CHOC-1K' => 3, 'CUP-12OZ-1000' => 1, 'LID-12OZ-1000' => 1],
            3  => ['BEAN-HOUSE-1K' => 15, 'BEAN-DECAF-1K' => 4, 'MILK-FULL-1L' => 80, 'MILK-OAT-1L' => 12, 'CREAM-WHIP-1L' => 8, 'TEA-CHAI-1L' => 4, 'CLEAN-TAB' => 2],
            4  => ['BEAN-HOUSE-1K' => 5, 'MILK-FULL-1L' => 25, 'TEA-CHAI-1L' => 2, 'CUP-12OZ-1000' => 1],
            14 => ['BEAN-HOUSE-1K' => 6, 'MILK-FULL-1L' => 30, 'CUP-12OZ-1000' => 2, 'LID-12OZ-1000' => 2, 'SYR-VAN-750' => 2],
            1  => ['BEAN-HOUSE-1K' => 3, 'BEAN-COLD-1K' => 4, 'SYR-CAR-750' => 2, 'CREAM-WHIP-1L' => 3],
        ];
        $premiumExtras = ['BEAN-ETH-1K' => 3, 'MILK-OAT-1L' => 10, 'SYR-HAZ-750' => 2, 'PWD-MATCHA-500' => 1];

        foreach ($outlets as $outlet) {
            if (!$outlet['customer']) {
                continue;
            }

            $basket = $baskets[$outlet['category']] ?? $baskets[2];
            if ($outlet['segment'] === 'premium') {
                $basket += $premiumExtras;
            }

            // Leave one or two items out, so similar outlets differ.
            $skip = array_rand($basket, min(2, max(1, count($basket) - 3)));
            foreach ((array) $skip as $sku) {
                unset($basket[$sku]);
            }

            $scale = $outlet['seats'] ? max(0.5, min(2.5, $outlet['seats'] / 50)) : 0.8;

            for ($monthsAgo = 5; $monthsAgo >= 0; $monthsAgo--) {
                $date = Carbon::today()->subMonths($monthsAgo)->startOfMonth()->addDays(mt_rand(2, 20));
                if ($date->isFuture()) {
                    continue;
                }

                $order = Order::create([
                    'lead_id'      => $outlet['lead']->id,
                    'order_date'   => $date->toDateString(),
                    'created_by'   => $outlet['rep']->id,
                    'status'       => Order::STATUS_CONFIRMED,
                    'total_amount' => 0,
                ]);

                $total = 0;
                foreach ($basket as $sku => $monthly) {
                    $quantity  = max(1, round($monthly * $scale * (0.8 + mt_rand(0, 40) / 100)));
                    $price     = (float) $products[$sku]->unit_price;
                    $lineTotal = round($quantity * $price, 2);
                    $total    += $lineTotal;

                    OrderLine::create([
                        'order_id'   => $order->id,
                        'product_id' => $products[$sku]->id,
                        'quantity'   => $quantity,
                        'unit_price' => $price,
                        'line_total' => $lineTotal,
                    ]);
                }

                $order->update(['order_no' => sprintf('ORD-%06d', $order->id), 'total_amount' => round($total, 2)]);
            }
        }
    }

    /** Visits over the last ten days; a few plan a follow-up for today. */
    private function visits(array $outlets): void
    {
        $notes = [
            'Owner happy with the house blend; asked about seasonal syrups.',
            'Grinder needs recalibration, espresso running fast.',
            'Staff turnover; offered a barista refresher session.',
            'Interested in an oat milk trial for the weekend crowd.',
            'Prospect: currently buying from a competitor, open to a tasting.',
            'Machine descaled; left cleaning tabs sample.',
        ];

        foreach ($outlets as $i => $outlet) {
            if ($i % 3 === 2) {
                continue; // not every outlet was visited
            }

            $visitedAt = Carbon::now()->subDays(mt_rand(0, 9))->setTime(mt_rand(9, 17), mt_rand(0, 59));
            $lead      = $outlet['lead'];

            $report = new IFEReport([
                'created_by'          => $outlet['rep']->id,
                'lead_id'             => $lead->id,
                'company_name'        => $lead->name,
                'shop_name'           => $lead->business_name,
                'nature_of_business'  => $lead->business_category,
                'status'              => $lead->customer_id ? 'Existing Customer' : 'New Customer',
                'ife_area'            => $lead->ife_area_id,
                'problem_description' => $notes[$i % count($notes)],
                'support_required'    => $i % 4 === 0 ? 'Yes' : 'N/A',
                'pic_name'            => 'Outlet manager',
                'mobile_number'       => $lead->mobile,
                'next_followup_date'  => $i % 5 === 0 ? Carbon::today()->toDateString() : Carbon::today()->addDays(mt_rand(3, 14))->toDateString(),
                'next_followup_plan'  => 'Follow up on the discussion and bring samples.',
                'location'            => $lead->business_name,
            ]);
            $report->created_at = $visitedAt;
            $report->updated_at = $visitedAt;
            $report->save();
        }
    }

    /**
     * Tasks in every state the dashboard shows: overdue, due within hours,
     * mostly-elapsed, on track, and some marked done over the last two weeks.
     */
    private function tasks(array $outlets, User $manager): void
    {
        $now   = Carbon::now();
        $plans = [
            // title, status, start (days from now), due (hours from now), done (days ago) or null
            ['Deliver oat milk trial pack',        2, -6,  -20,  null],
            ['Recalibrate grinder',                2, -3,  -2,   null],
            ['Barista refresher session',          1, -2,   5,   null],
            ['Collect overdue invoice',            2, -1,   8,   null],
            ['Tasting session for new blend',      2, -10,  40,  null],
            ['Quarterly machine service',          1, -1,  120,  null],
            ['Menu board syrup promotion',         2, -2,  200,  null],
            ['Follow up competitor switch',        1,  0,  300,  null],
            ['Install second grinder',             3, -12, -48,  2],
            ['Replace group head gaskets',         3, -9,  -24,  5],
            ['Seasonal menu training',             3, -14, -72,  9],
            ['Set up cold brew station',           3, -6,  -10,  1],
        ];

        foreach ($plans as $i => [$title, $status, $startDays, $dueHours, $doneDaysAgo]) {
            $outlet = $outlets[$i % count($outlets)];
            $start  = $now->copy()->addDays($startDays)->setTime(9, 0);
            $due    = $now->copy()->addHours($dueHours);

            $task = new Tasks();
            $task->status          = $status;
            $task->lead_id         = $outlet['lead']->id;
            $task->task_reference  = Tasks::nextReference();
            $task->title           = $title;
            $task->start_date      = $start->toDateString();
            $task->start_time      = $start->format('H:i:s');
            $task->due_date        = $due->toDateString();
            $task->due_time        = $due->format('H:i:s');
            $task->creation_date   = $start;
            $task->inprogress_date = $status >= 2 ? $start->copy()->addHours(2) : null;
            $task->done_date       = $doneDaysAgo !== null ? $now->copy()->subDays($doneDaysAgo) : null;
            $task->save();

            foreach ([[1, $manager->id], [2, $outlet['rep']->id], [3, $manager->id], [4, $manager->id]] as [$role, $userId]) {
                TaskUsers::create(['task_id' => $task->id, 'user_id' => $userId, 'role' => $role]);
            }
        }
    }
}
