<?php

namespace App\Http\Resources\Forms;

use App\Services\FormRecordService;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A row of the Records screens (FormRecordService::summarize()).
 *
 * @mixin \App\Models\FormSubmission
 */
class RecordRowResource extends JsonResource
{
    public function toArray($request): array
    {
        $summary = app(FormRecordService::class)->summarize($this->resource);

        return [
            'id'               => $this->id,
            'reference'        => $summary['reference'],
            'title'            => $summary['title'],
            'form_name'        => optional($this->form)->name ?? 'N/A',
            'submitted_by'     => optional($this->submittedBy)->name ?? 'Unknown',
            'created_at'       => optional($this->created_at)->format('d M Y'),
            'closed'           => !$this->isRecordOpen(),
            // Says at a glance that this is a return visit, and onto which case.
            'parent_reference' => $this->parent ? $this->parent->recordReference() : null,
            'stage_name'       => $summary['stage_name'],
            'waiting_on'       => $summary['waiting_on'],
            'status'           => $summary['status'],
            'updated_at'       => optional($summary['updated_at'])->format('d M Y H:i'),
        ];
    }
}
