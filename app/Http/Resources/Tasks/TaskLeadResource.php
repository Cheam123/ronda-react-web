<?php

namespace App\Http\Resources\Tasks;

use App\Helpers\Helper;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The read-only "Lead/Customer Detail" block of the task pages.
 *
 * @mixin \App\Models\Leads
 */
class TaskLeadResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'business_name'     => $this->business_name,
            'customer_id'       => $this->customer_id,
            'mobile'            => $this->mobile,
            'email'             => $this->email,
            'source'            => Helper::getLeadSource($this->source),
            'business_category' => Helper::getBusinessCategory($this->business_category),
            'address'           => $this->address,
            'state'             => Helper::getState($this->state_id),
            'city'              => Helper::getCity($this->city_id),
            'postcode'          => $this->postcode,
            'ife_area'          => optional($this->ifearea)->area,
            'remark'            => $this->remark,
            'created_by'        => optional($this->createdBy)->name,
        ];
    }
}
