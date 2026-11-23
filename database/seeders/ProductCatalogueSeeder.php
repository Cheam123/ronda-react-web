<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Adds the products in database/data/products.json that the catalogue doesn't
 * have yet, matched by name. Never changes a product that is already there, so
 * it is safe to re-run. The drinks in recipes.json are made from these.
 *
 *     php artisan db:seed --class=ProductCatalogueSeeder
 *     php artisan db:seed --class=RecipeSeeder
 */
class ProductCatalogueSeeder extends Seeder
{
    /** @var string[] names added by the last run */
    public array $added = [];

    public function __construct(private ?string $path = null)
    {
    }

    /** @return array<int, array{name: string, category: string, unit: string, unit_price: float, monthly_quantity: float, halal: bool}> */
    public static function products(?string $path = null): array
    {
        $file = $path ?? database_path('data/products.json');

        return json_decode((string) file_get_contents($file), true)['products'] ?? [];
    }

    public function run()
    {
        $existing = Product::withTrashed()->pluck('name')
            ->map(fn ($name) => mb_strtolower(trim($name)))
            ->flip();
        $next = (int) Product::withTrashed()->max('id') + 1;

        foreach (self::products($this->path) as $product) {
            if ($existing->has(mb_strtolower($product['name']))) {
                continue;
            }

            Product::create([
                'sku'              => sprintf('CAT-%05d', $next++),
                'name'             => $product['name'],
                'category'         => $product['category'],
                'unit'             => $product['unit'],
                'unit_price'       => $product['unit_price'],
                'is_halal'         => $product['halal'],
                'base_monthly_qty' => $product['monthly_quantity'],
                'is_active'        => true,
            ]);
            $this->added[] = $product['name'];
        }

        $this->command?->info(sprintf('Products: %d added, %d already there.', count($this->added), count(self::products($this->path)) - count($this->added)));
    }
}
