<?php

namespace Database\Seeders;

use App\Models\AreaRule;
use Illuminate\Database\Seeder;

/**
 * Loads the starting area rules in database/data/area_rules.json. Safe to
 * re-run: a rule an admin has already saved is left as it is.
 *
 *     php artisan db:seed --class=AreaRuleSeeder
 */
class AreaRuleSeeder extends Seeder
{
    public function run()
    {
        $kinds = array_keys(AreaRule::kinds());

        foreach (AreaRule::defaults() as $kind => $rule) {
            if (!in_array($kind, $kinds, true)) {
                continue;
            }

            AreaRule::firstOrCreate(['kind' => $kind], [
                'categories'  => array_values($rule['categories'] ?? []),
                'price_tiers' => array_values($rule['price_tiers'] ?? []),
                'note'        => $rule['note'] ?? null,
            ]);
        }
    }
}
