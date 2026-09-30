<?php

namespace App\Http\Resources\IfeReports;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * A row of the IFE report list.
 *
 * @mixin \App\Models\IFEReport
 */
class IfeReportListResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'           => $this->id,
            'ife_area'     => optional($this->area)->area,
            'salesperson'  => optional($this->createdBy)->name,
            'company_name' => $this->company_name,
            'shop_name'    => $this->shop_name,
            'created_at'   => Carbon::parse($this->created_at)->format('Y-m-d, h:i:s A'),
            'location'     => $this->location,
            // A report becomes a task once; after that it links to it.
            'has_task'     => (bool) $this->task_id,
        ];
    }
}
