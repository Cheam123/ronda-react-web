<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An item in the product catalogue. Admins maintain it; order lines and
 * product recommendations point at it. Inactive products stay on old orders
 * but are no longer offered or recommended.
 */
class Product extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'sku',
        'name',
        'category',
        'unit',
        'unit_price',
        'description',
        'is_active',
    ];

    protected $casts = [
        'unit_price' => 'float',
        'is_active'  => 'boolean',
    ];

    /** Products with no confirmed order this many days are flagged for review. */
    public const STALE_DAYS = 90;

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Active products that have been in the catalogue for STALE_DAYS and
     * were not on a confirmed order in that time. A product added last week
     * is not stale just because nobody has ordered it yet.
     */
    public function scopeStale($query, ?\Carbon\CarbonInterface $now = null)
    {
        $cutoff = ($now ? $now->copy() : now())->subDays(self::STALE_DAYS);

        return $query->active()
            ->where('created_at', '<=', $cutoff)
            ->whereDoesntHave('orderLines', fn ($lines) => $lines->whereHas(
                'order',
                fn ($orders) => $orders->confirmed()->where('order_date', '>=', $cutoff->toDateString())
            ));
    }

    public function orderLines()
    {
        return $this->hasMany(OrderLine::class, 'product_id');
    }

    /** Distinct categories in use, for the catalogue filter and form suggestions. */
    public static function categories(): array
    {
        return static::whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category')
            ->all();
    }
}
