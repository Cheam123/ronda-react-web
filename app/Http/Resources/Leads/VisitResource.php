<?php

namespace App\Http\Resources\Leads;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A visit (IFE report) on the outlet's activity tab.
 *
 * @mixin \App\Models\IFEReport
 */
class VisitResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'visited_at'    => $this->created_at->format('j M Y, g:i A'),
            'visited_by'    => optional($this->createdBy)->name,
            'status'        => $this->status,
            'summary'       => Str::limit($this->problem_description, 160),
            'followup_date' => $this->next_followup_date ? Carbon::parse($this->next_followup_date)->format('j M Y') : null,
            'followup_plan' => $this->next_followup_plan ? Str::limit($this->next_followup_plan, 80) : null,
        ];
    }
}
