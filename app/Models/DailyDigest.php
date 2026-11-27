<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The manager digest for one day (see DailyDigestService).
 */
class DailyDigest extends Model
{
    protected $fillable = [
        'digest_date',
        'content',
        'source',
        'error',
    ];

    protected $casts = [
        'digest_date' => 'date',
    ];

    public static function latestDigest(): ?self
    {
        return static::orderByDesc('digest_date')->first();
    }
}
