<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A drink an outlet could make from catalogue products.
 *
 * Who it suits is tagged on the drink, not on its syrups: a bottle of
 * strawberry syrup doesn't suit students, an iced strawberry matcha might.
 */
class Recipe extends Model
{
    /** How a drink is served. */
    public const SERVES = [
        'hot'    => 'Hot',
        'iced'   => 'Iced',
        'either' => 'Hot or iced',
    ];

    /** The kind of drink. A menu with none of a kind has a gap there. */
    public const CATEGORIES = [
        'coffee'           => 'Coffee',
        'flavoured_coffee' => 'Flavoured coffee',
        'kopitiam'         => 'Kopitiam classics',
        'tea'              => 'Tea',
        'fruit_tea'        => 'Fruit tea',
        'matcha'           => 'Matcha',
        'chocolate'        => 'Chocolate, malt and milk',
        'sparkling'        => 'Sparkling and mocktails',
    ];

    /** Price levels a drink can be aimed at. None means any. */
    public const PRICE_TIERS = [
        'budget'    => 'Budget',
        'mid_range' => 'Mid-range',
        'premium'   => 'Premium',
    ];

    protected $fillable = [
        'name',
        'slug',
        'aliases',
        'category',
        'description',
        'serve',
        'outlet_types',
        'customer_groups',
        'price_tier',
        'is_active',
        'everyday',
    ];

    protected $casts = [
        'aliases'         => 'array',
        'outlet_types'    => 'array',
        'customer_groups' => 'array',
        'is_active'       => 'boolean',
        'everyday'        => 'boolean',
    ];

    /** @return array<string, string> area kind => label */
    public static function customerGroups(): array
    {
        return config('ife.recommendation.customer_groups', []);
    }

    /** @return string[] every name a menu may use for this drink: its name first, then the other names */
    public function names(): array
    {
        return array_values(array_unique(array_filter(array_map('trim', array_merge([(string) $this->name], $this->aliases ?? [])))));
    }

    public function ingredients()
    {
        return $this->hasMany(RecipeIngredient::class)->orderBy('sort')->orderBy('id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** Halal only when every ingredient is. Needs ingredients.product loaded or loadable. */
    public function isHalal(): bool
    {
        return $this->ingredients->every(fn (RecipeIngredient $ingredient) => (bool) optional($ingredient->product)->is_halal);
    }

    /** RM for one serve, from each ingredient's share of its product's unit price. */
    public function costPerServe(): float
    {
        return round($this->ingredients->sum(
            fn (RecipeIngredient $ingredient) => $ingredient->quantity * (float) optional($ingredient->product)->unit_price
        ), 2);
    }
}
