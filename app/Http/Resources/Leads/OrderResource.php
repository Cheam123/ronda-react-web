<?php

namespace App\Http\Resources\Leads;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order on the outlet's order history.
 *
 * @mixin \App\Models\Order
 */
class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'           => $this->id,
            'order_no'     => $this->order_no,
            'order_date'   => $this->order_date->format('j M Y'),
            'cancelled'    => $this->isCancelled(),
            'remark'       => $this->remark,
            'total_amount' => (float) $this->total_amount,
            'recorded_by'  => optional($this->createdBy)->name,
            'lines'        => $this->lines->map(fn ($line) => [
                'quantity' => (float) $line->quantity,
                'unit'     => optional($line->product)->unit,
                'product'  => optional($line->product)->name,
            ])->values()->all(),
        ];
    }
}
