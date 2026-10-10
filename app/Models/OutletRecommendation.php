<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Precomputed recommendations for one outlet (see RecommendationService).
 */
class OutletRecommendation extends Model
{
    protected $fillable = [
        'lead_id',
        'items',
        'neighbors',
        'items_hash',
        'gap_count',
        'estimated_monthly_value',
        'explanation',
        'opening_line',
        'explanation_source',
        'explained_hash',
        'pitches',
        'pitches_source',
        'pitched_hash',
        'computed_at',
    ];

    protected $casts = [
        'items'                   => 'array',
        'neighbors'               => 'array',
        'pitches'                 => 'array',
        'gap_count'               => 'integer',
        'estimated_monthly_value' => 'float',
        'computed_at'             => 'datetime',
    ];

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id')->withTrashed();
    }

    /** Whether the cached explanation was written for the current items. */
    public function hasFreshExplanation(): bool
    {
        return $this->explanation !== null && $this->explained_hash === $this->items_hash;
    }

    /** Whether the cached pitch tips were written for the current items. */
    public function hasFreshPitches(): bool
    {
        return $this->pitches !== null && $this->pitched_hash === $this->items_hash;
    }
}
