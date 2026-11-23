<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One reading of an outlet's drinks menu. A draft until the rep has checked
 * what was found; the newest confirmed scan is the outlet's menu.
 */
class MenuScan extends Model
{
    public const SOURCE_PHONE = 'phone';
    public const SOURCE_TYPED = 'typed';
    /** Photos read on the server with Amazon Textract. */
    public const SOURCE_TEXTRACT = 'textract';

    public const STATUS_DRAFT     = 'draft';
    public const STATUS_CONFIRMED = 'confirmed';

    protected $fillable = [
        'lead_id', 'user_id', 'source', 'status', 'fragments', 'median_price', 'price_level', 'ideas', 'confirmed_at',
    ];

    protected $casts = [
        'fragments'    => 'array',
        'ideas'        => 'array',
        'median_price' => 'float',
        'confirmed_at' => 'datetime',
    ];

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id')->withTrashed();
    }

    public function items()
    {
        return $this->hasMany(MenuScanItem::class)->orderBy('position')->orderBy('id');
    }

    public function photos()
    {
        return $this->hasMany(DocumentUpload::class, 'menu_scan_id')->orderBy('id');
    }

    public function isConfirmed(): bool
    {
        return $this->status === self::STATUS_CONFIRMED;
    }

    /** @return int[] the drinks this scan says are on the menu */
    public function drinkIds(): array
    {
        return $this->items
            ->where('kind', MenuScanItem::KIND_MATCHED)
            ->where('kept', true)
            ->pluck('recipe_id')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
