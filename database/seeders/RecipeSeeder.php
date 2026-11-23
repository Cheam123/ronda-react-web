<?php

namespace Database\Seeders;

use App\Helpers\Helper;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeIngredient;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Loads the drinks in database/data/recipes.json. Safe to re-run: drinks are
 * matched by slug and their ingredients replaced.
 *
 * Products are matched by name among active products. A drink with an
 * ingredient the catalogue doesn't have is skipped and named, so the 16-product
 * demo catalogue gets only the drinks it can make.
 *
 *     php artisan db:seed --class=RecipeSeeder
 */
class RecipeSeeder extends Seeder
{
    /** @var array{loaded: string[], skipped: array<string, string[]>} */
    public array $result = ['loaded' => [], 'skipped' => []];

    public function __construct(private ?string $path = null)
    {
    }

    /** @return array<int, array> the drinks in the file */
    public static function drinks(?string $path = null): array
    {
        $file = $path ?? database_path('data/recipes.json');

        return json_decode((string) file_get_contents($file), true)['drinks'] ?? [];
    }

    public function run()
    {
        $products = Product::active()->get(['id', 'name'])
            ->keyBy(fn (Product $product) => mb_strtolower(trim($product->name)));
        $types    = array_flip(Helper::getBusinessCategoryListing());
        $groups   = array_keys(Recipe::customerGroups());

        foreach (self::drinks($this->path) as $drink) {
            $missing = [];
            foreach ($drink['ingredients'] as $ingredient) {
                if (!$products->has(mb_strtolower($ingredient['product']))) {
                    $missing[] = $ingredient['product'];
                }
            }

            if ($missing) {
                $this->result['skipped'][$drink['name']] = $missing;
                continue;
            }

            DB::transaction(function () use ($drink, $products, $types, $groups) {
                $recipe = Recipe::updateOrCreate(['slug' => $drink['slug']], [
                    'name'            => $drink['name'],
                    'aliases'         => !empty($drink['aliases']) ? array_values($drink['aliases']) : null,
                    'category'        => $drink['category'] ?? null,
                    'description'     => $drink['description'] ?? null,
                    'serve'           => $drink['serve'],
                    'outlet_types'    => array_values(array_map(fn ($label) => $types[$label], $drink['outlet_types'])),
                    'customer_groups' => array_values(array_intersect($drink['customer_groups'], $groups)),
                    'price_tier'      => $drink['price_tier'] ?? null,
                    'is_active'       => true,
                    'everyday'        => (bool) ($drink['everyday'] ?? false),
                ]);

                $recipe->ingredients()->delete();
                foreach ($drink['ingredients'] as $sort => $ingredient) {
                    RecipeIngredient::create([
                        'recipe_id'    => $recipe->id,
                        'product_id'   => $products[mb_strtolower($ingredient['product'])]->id,
                        'quantity'     => $ingredient['quantity'],
                        'amount_label' => $ingredient['amount'] ?? null,
                        'sort'         => $sort,
                    ]);
                }
            });

            $this->result['loaded'][] = $drink['name'];
        }

        $this->command?->info(count($this->result['loaded']) . ' drinks loaded.');
        foreach ($this->result['skipped'] as $name => $missing) {
            $this->command?->warn("Skipped {$name}: the catalogue has no " . implode(', ', $missing) . '.');
        }
    }
}
