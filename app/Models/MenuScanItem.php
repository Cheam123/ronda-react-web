<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One row of a scanned menu: a drink we know, or a priced row we didn't recognise. */
class MenuScanItem extends Model
{
    public const KIND_MATCHED      = 'matched';
    public const KIND_UNRECOGNISED = 'unrecognised';

    protected $fillable = [
        'menu_scan_id', 'row_text', 'page', 'position', 'price', 'kind', 'recipe_id', 'match_share', 'kept', 'changed_by_rep',
    ];

    protected $casts = [
        'price'          => 'float',
        'match_share'    => 'float',
        'kept'           => 'boolean',
        'changed_by_rep' => 'boolean',
    ];

    public function scan()
    {
        return $this->belongsTo(MenuScan::class, 'menu_scan_id');
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class, 'recipe_id');
    }
}
