<?php

namespace App\Http\Resources\Leads;

use App\Helpers\Helper;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A row of the Lead/Customer list.
 *
 * @mixin \App\Models\Leads
 */
class LeadListResource extends JsonResource
{
    public function toArray($request): array
    {
        $city  = $this->city_id ? Helper::getCity($this->city_id) : '';
        $state = $this->state_id ? Helper::getState($this->state_id) : '';

        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'business_name'      => $this->business_name,
            'customer_id'        => $this->customer_id,
            'mobile'             => $this->mobile,
            'email'              => $this->email,
            'location'           => implode(', ', array_filter([$city, $state])),
            'upline_name'        => $this->upline_name,
            'presales_name'      => $this->presales_name,
            'closing_sales_name' => $this->closing_sales_name,
            'ife_area'           => optional($this->ifearea)->area,
            'created_by'         => optional($this->createdBy)->name,
            'assignee'           => $this->assign_to ? optional($this->assignee)->name : null,
            'created_date'       => optional($this->created_at)->format('Y-m-d'),
            'created_time'       => optional($this->created_at)->format('h:i:s A'),
            // A lead with work still open (New .. KIV) cannot be deleted.
            'deletable'          => $this->tasks->whereIn('status', [1, 2, 3, 4, 5, 6])->isEmpty(),
            // A prospect gets one running task at a time; a customer any number.
            'taskable'           => (bool) $this->customer_id || $this->runningTasks->isEmpty(),
        ];
    }
}
