<?php

namespace App\Http\Resources\Forms;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One Handler or Approval step on a record's progress timeline.
 *
 * @mixin \App\Models\FormSubmissionApproval
 */
class ApprovalStageResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'is_fill'       => $this->isFillNode(),
            'approval_mode' => $this->approval_mode,
            'iteration'     => (int) $this->iteration,
            'status'        => $this->status,
            'acted_by'      => optional($this->actedBy)->name,
            'acted_at'      => optional($this->acted_at)->format('d M'),
            'remark'        => $this->remark,
        ];
    }
}
