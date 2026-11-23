<?php

namespace Tests\Unit;

use App\Helpers\Helper;
use PHPUnit\Framework\TestCase;

/**
 * database/data/recipes.json is read by RecipeSeeder. Every drink must be
 * makeable from the products in database/data/products.json and use only
 * known tags.
 */
class RecipeCatalogueTest extends TestCase
{
    private const SERVES = ['hot', 'iced', 'either'];
    private const TIERS = ['budget', 'mid_range', 'premium'];

    private static function drinks(): array
    {
        $file = __DIR__ . '/../../database/data/recipes.json';

        return json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR)['drinks'];
    }

    /** The outlet types and customer groups a drink may be tagged with. */
    private const OUTLET_TYPES = [1, 2, 3, 4, 5, 7, 14];
    private const CUSTOMER_GROUPS = ['office', 'residential', 'university', 'tourist', 'industrial', 'retail', 'transit', 'recreation'];

    /** @return array<string, array> name => product, from database/data/products.json */
    private static function catalogue(): array
    {
        $file = __DIR__ . '/../../database/data/products.json';

        return array_column(json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR)['products'], null, 'name');
    }

    public function test_the_catalogue_has_86_products_with_unique_names(): void
    {
        $file     = __DIR__ . '/../../database/data/products.json';
        $products = json_decode((string) file_get_contents($file), true, 512, JSON_THROW_ON_ERROR)['products'];

        $this->assertCount(86, $products);
        $this->assertCount(86, array_unique(array_column($products, 'name')));
    }

    public function test_there_are_44_drinks_with_unique_slugs_and_names(): void
    {
        $drinks = self::drinks();

        $this->assertCount(44, $drinks);
        $this->assertCount(44, array_unique(array_column($drinks, 'slug')));
        $this->assertCount(44, array_unique(array_column($drinks, 'name')));

        foreach ($drinks as $drink) {
            $this->assertMatchesRegularExpression('/^[a-z0-9]+(-[a-z0-9]+)*$/', $drink['slug']);
        }
    }

    public function test_every_ingredient_is_in_the_catalogue_once_per_drink(): void
    {
        $catalogue = self::catalogue();

        foreach (self::drinks() as $drink) {
            $this->assertNotEmpty($drink['ingredients'], $drink['name']);
            $names = array_column($drink['ingredients'], 'product');
            $this->assertSame($names, array_values(array_unique($names)), "{$drink['name']} lists a product twice");

            foreach ($drink['ingredients'] as $ingredient) {
                $this->assertArrayHasKey($ingredient['product'], $catalogue, "{$drink['name']}: unknown product");
                $this->assertGreaterThan(0, $ingredient['quantity']);
                $this->assertLessThan(1, $ingredient['quantity'], "{$drink['name']}: one serve should be under a whole unit");
                $this->assertNotSame('', trim($ingredient['amount']));
            }
        }
    }

    public function test_tags_use_known_values(): void
    {
        $labels      = Helper::getBusinessCategoryListing();
        $outletTypes = array_map(fn ($id) => $labels[$id], self::OUTLET_TYPES);

        foreach (self::drinks() as $drink) {
            $this->assertContains($drink['serve'], self::SERVES, $drink['name']);
            $this->assertContains($drink['price_tier'], self::TIERS, $drink['name']);
            $this->assertNotEmpty($drink['customer_groups'], $drink['name']);
            $this->assertNotEmpty($drink['outlet_types'], $drink['name']);

            foreach ($drink['customer_groups'] as $group) {
                $this->assertContains($group, self::CUSTOMER_GROUPS, $drink['name']);
            }
            foreach ($drink['outlet_types'] as $type) {
                $this->assertContains($type, $outletTypes, $drink['name']);
            }
        }
    }

    public function test_every_drink_has_a_known_kind_and_no_two_drinks_share_a_name_a_menu_may_use(): void
    {
        $kinds = ['coffee', 'flavoured_coffee', 'kopitiam', 'tea', 'fruit_tea', 'matcha', 'chocolate', 'sparkling'];
        $owner = [];

        foreach (self::drinks() as $drink) {
            $this->assertContains($drink['category'], $kinds, $drink['name']);
            $this->assertIsArray($drink['aliases'], $drink['name']);

            foreach (array_merge([$drink['name']], $drink['aliases']) as $name) {
                $key = mb_strtolower(trim($name));
                $this->assertNotSame('', $key, $drink['name']);
                $this->assertArrayNotHasKey($key, $owner, "\"{$name}\" is a name of both {$drink['name']} and " . ($owner[$key] ?? ''));
                $owner[$key] = $drink['name'];
            }
        }
    }

    public function test_only_the_two_bar_drinks_contain_a_non_halal_product(): void
    {
        $catalogue = self::catalogue();
        $notHalal  = [];

        foreach (self::drinks() as $drink) {
            foreach ($drink['ingredients'] as $ingredient) {
                if ($catalogue[$ingredient['product']]['halal'] === false) {
                    $notHalal[] = $drink['slug'];
                    break;
                }
            }
        }

        $this->assertSame(['tonic-and-bitters', 'rum-caramel-latte'], $notHalal);
    }
}
