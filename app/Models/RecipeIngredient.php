<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One product in a drink. `quantity` is per serve in the product's unit, so a
 * shot of espresso from a kg bag is 0.018; `amount_label` reads "18 g".
 */
class RecipeIngredient extends Model
{
    protected $fillable = [
        'recipe_id',
        'product_id',
        'quantity',
        'amount_label',
        'sort',
    ];

    protected $casts = [
        'quantity' => 'float',
        'sort'     => 'integer',
    ];

    public function recipe()
    {
        return $this->belongsTo(Recipe::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
