<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The visit brief for one outlet (see OutletAssistantService::brief()).
 */
class OutletBrief extends Model
{
    protected $fillable = [
        'lead_id',
        'content',
        'source',
        'model',
        'input_tokens',
        'output_tokens',
        'error',
        'data_hash',
        'generated_by',
        'generated_at',
    ];

    protected $casts = [
        'input_tokens'  => 'integer',
        'output_tokens' => 'integer',
        'generated_at'  => 'datetime',
    ];

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id')->withTrashed();
    }

    public function generatedBy()
    {
        return $this->belongsTo(User::class, 'generated_by')->withTrashed();
    }
}
