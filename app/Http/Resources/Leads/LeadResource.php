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
            'is_halal'          => $this->is_halal,
            'main_customers'    => $this->main_customers ?? [],
            'best_selling_kinds'  => $this->best_selling_kinds ?? [],
            'improvement_goals'   => $this->improvement_goals ?? [],
            'typical_drink_price' => $this->typical_drink_price,
            'area'              => $this->areaProfile(),
            'gps'               => $stamp ? json_encode($stamp) : '',
            'remark'            => $this->remark,
            // For the outlet page's header and details.
            'assignee'          => $this->assign_to ? optional($this->assignee)->name : null,
            'assignee_id'       => $this->assign_to,
            'created_by'        => optional($this->createdBy)->name,
            // A prospect gets one running task at a time; a customer any number (as LeadListResource).
            'taskable'          => (bool) $this->customer_id || $this->runningTasks()->doesntExist(),
        ];
    }
}
