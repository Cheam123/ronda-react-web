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
        $filed = Carbon::parse($this->created_at);

        return [
            'id'             => $this->id,
            'ife_area'       => optional($this->area)->area,
            // Picks the area tag's colour (lib/tags).
            'ife_area_id'    => $this->ife_area ? (int) $this->ife_area : null,
            'salesperson'    => optional($this->createdBy)->name,
            'salesperson_id' => $this->created_by ? (int) $this->created_by : null,
            'company_name'   => $this->company_name,
            'shop_name'      => $this->shop_name,
            'filed_date'     => $filed->format('j M Y'),
            'filed_time'     => $filed->format('g:i a'),
            'location'       => $this->location,
            // A report becomes a task once; after that it links to it.
            'has_task'       => (bool) $this->task_id,
        ];
    }
}
