<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An order an outlet (lead) placed. Created through OrderService so the lines,
 * prices and total always agree.
 */
class Order extends Model
{
    use SoftDeletes;

    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'order_no',
        'lead_id',
        'order_date',
        'created_by',
        'status',
        'total_amount',
        'remark',
    ];

    protected $casts = [
        'order_date'   => 'date',
        'total_amount' => 'float',
    ];

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id')->withTrashed();
    }

    public function lines()
    {
        return $this->hasMany(OrderLine::class, 'order_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    public function scopeConfirmed($query)
    {
        return $query->where('status', self::STATUS_CONFIRMED);
    }

    public function isCancelled(): bool
    {
        return $this->status === self::STATUS_CANCELLED;
    }

    /** Mobile / JSON shape, shared by the order history and create responses. */
    public function toSummary(): array
    {
        return [
            'id'           => $this->id,
            'order_no'     => $this->order_no,
            'order_date'   => optional($this->order_date)->toDateString(),
            'status'       => $this->status,
            'total_amount' => round((float) $this->total_amount, 2),
            'remark'       => $this->remark,
            'created_by'   => optional($this->createdBy)->name,
            'lines'        => $this->lines->map(fn (OrderLine $line) => [
                'product_id'   => $line->product_id,
                'sku'          => optional($line->product)->sku,
                'product_name' => optional($line->product)->name,
                'unit'         => optional($line->product)->unit,
                'quantity'     => (float) $line->quantity,
                'unit_price'   => (float) $line->unit_price,
                'line_total'   => (float) $line->line_total,
                'suggested'    => (bool) $line->suggested,
            ])->values()->all(),
        ];
    }
}
