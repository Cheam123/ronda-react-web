<?php

namespace App\Http\Resources\Forms;

use App\Services\FormRecordService;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Another case referred to from a record: the one it follows up on, a
 * follow-up opened from it, or an option in the "Follows up on" picker.
 *
 * @mixin \App\Models\FormSubmission
 */
class CaseLinkResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'           => $this->id,
            'reference'    => $this->recordReference(),
            'title'        => app(FormRecordService::class)->titleFor($this->resource),
            'status'       => $this->status,
            'open'         => $this->isRecordOpen(),
            'created_at'   => optional($this->created_at)->format('d M Y, h:i A'),
            // Only where it was loaded: the follow-up picker lists many cases.
            'submitted_by' => $this->whenLoaded('submittedBy', fn () => optional($this->submittedBy)->name ?? 'Unknown'),
        ];
    }
}
