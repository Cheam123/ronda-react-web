<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Recipe;
use Database\Seeders\ProductCatalogueSeeder;
use Database\Seeders\RecipeSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** The drink list loads, re-runs cleanly and skips drinks the catalogue can't make. */
class RecipeSeederTest extends TestCase
{
    use DatabaseTransactions;

    private function catalogue(array $without = []): void
    {
        // Start from no active products, so leftovers in the test database can't match by name.
        Product::query()->update(['is_active' => false]);

        foreach (ProductCatalogueSeeder::products() as $i => $product) {
            if (in_array($product['name'], $without, true)) {
                continue;
            }
            Product::create([
                'sku' => sprintf('TEST-RCP-%03d', $i), 'name' => $product['name'], 'category' => $product['category'], 'unit' => $product['unit'],
                'unit_price' => $product['unit_price'], 'is_halal' => $product['halal'], 'is_active' => true,
            ]);
        }
    }

    private function runSeeder(): RecipeSeeder
    {
        $seeder = new RecipeSeeder();
        $seeder->run();

        return $seeder;
    }

    public function test_all_44_drinks_load_with_their_ingredients_in_order(): void
    {
        $this->catalogue();
        $seeder = $this->runSeeder();

        $this->assertCount(44, $seeder->result['loaded']);
        $this->assertSame([], $seeder->result['skipped']);

        $latte = Recipe::with('ingredients.product')->where('slug', 'iced-vanilla-latte')->firstOrFail();
        $this->assertSame('iced', $latte->serve);
        $this->assertSame([2, 14], $latte->outlet_types);
        $this->assertSame(['university', 'retail', 'office'], $latte->customer_groups);
        $this->assertSame('mid_range', $latte->price_tier);
        $this->assertSame('flavoured_coffee', $latte->category);
        $this->assertSame(['Iced Vanilla Latte', 'Vanilla Latte'], $latte->names());
        $this->assertSame(
            ['House Espresso Blend', 'Full Cream Milk', 'Vanilla Syrup'],
            $latte->ingredients->pluck('product.name')->all()
        );
        $this->assertSame('18 g', $latte->ingredients->first()->amount_label);
        // 0.018 x 75 + 0.2 x 7.50 + 0.02 x 32 = 1.35 + 1.50 + 0.64
        $this->assertEqualsWithDelta(3.49, $latte->costPerServe(), 0.001);
        $this->assertTrue($latte->isHalal());
    }

    public function test_halal_is_worked_out_from_the_ingredients(): void
    {
        $this->catalogue();
        $this->runSeeder();

        $this->assertFalse(Recipe::with('ingredients.product')->where('slug', 'tonic-and-bitters')->firstOrFail()->isHalal());
        $this->assertFalse(Recipe::with('ingredients.product')->where('slug', 'rum-caramel-latte')->firstOrFail()->isHalal());
        $this->assertTrue(Recipe::with('ingredients.product')->where('slug', 'ginger-lime-mule')->firstOrFail()->isHalal());
    }

    public function test_running_it_again_changes_nothing(): void
    {
        $this->catalogue();
        $this->runSeeder();
        $recipes     = Recipe::count();
        $ingredients = Recipe::withCount('ingredients')->get()->sum('ingredients_count');

        $this->runSeeder();

        $this->assertSame($recipes, Recipe::count());
        $this->assertSame($ingredients, Recipe::withCount('ingredients')->get()->sum('ingredients_count'));
    }

    public function test_a_drink_with_a_missing_product_is_skipped_and_named(): void
    {
        $this->catalogue(without: ['Strawberry Syrup']);
        $seeder = $this->runSeeder();

        $this->assertSame(
            ['Strawberry Matcha Latte' => ['Strawberry Syrup'], 'Strawberry Peach Tea' => ['Strawberry Syrup']],
            $seeder->result['skipped']
        );
        $this->assertCount(42, $seeder->result['loaded']);
        $this->assertFalse(Recipe::where('slug', 'strawberry-peach-tea')->exists());
    }

    public function test_the_product_seeder_adds_what_is_missing_once_and_then_every_drink_loads(): void
    {
        Product::query()->update(['is_active' => false]);
        Product::create(['sku' => 'TEST-OWN-MILK', 'name' => 'Full Cream Milk', 'unit' => 'litre', 'unit_price' => 9.9, 'is_halal' => true, 'is_active' => true]);

        $first = new ProductCatalogueSeeder();
        $first->run();
        $again = new ProductCatalogueSeeder();
        $again->run();

        $this->assertNotContains('Full Cream Milk', $first->added, 'a product already there is left alone');
        $this->assertSame(9.9, Product::where('sku', 'TEST-OWN-MILK')->value('unit_price'));
        $this->assertContains('Strawberry Syrup', $first->added);
        $this->assertSame([], $again->added);

        $this->assertCount(44, $this->runSeeder()->result['loaded']);
    }
}
