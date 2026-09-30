<?php

namespace App\Http\Resources\Leads;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A lead for its create / edit / view form.
 *
 * @mixin \App\Models\Leads
 */
class LeadResource extends JsonResource
{
    public function toArray($request): array
    {
        $stamp = $this->locationStamp();

        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'business_name'     => $this->business_name,
            'customer_id'       => $this->customer_id,
            'receiving_date'    => $this->receiving_date ? substr((string) $this->receiving_date, 0, 10) : null,
            'mobile'            => $this->mobile,
            'email'             => $this->email,
            'source'            => $this->source,
            'business_category' => $this->business_category,
            'address'           => $this->address,
            'state_id'          => $this->state_id,
            'city_id'           => $this->city_id,
            'postcode'          => $this->postcode,
            'ife_area_id'       => $this->ife_area_id,
            'size_band'         => $this->size_band,
            'seats'             => $this->seats,
            'segment'           => $this->segment,
            'gps'               => $stamp ? json_encode($stamp) : '',
            'remark'            => $this->remark,
        ];
    }
}
