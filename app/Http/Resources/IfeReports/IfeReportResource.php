<?php

namespace App\Http\Resources\IfeReports;

use App\Helpers\Helper;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One IFE (in-field) visit report, everything the report page shows.
 *
 * @mixin \App\Models\IFEReport
 */
class IfeReportResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                   => $this->id,
            'salesperson'          => optional($this->createdBy)->name,
            'created_at'           => $this->created_at->format('M j, Y g:i A'),
            'updated_at'           => $this->updated_at->format('M j, Y g:i A'),
            'task_title'           => optional($this->task)->title,
            'company_name'         => $this->company_name,
            // Filed from an existing lead it holds the lead's category id; typed in the app, free text.
            'nature_of_business'   => is_numeric($this->nature_of_business)
                ? (Helper::getBusinessCategory((int) $this->nature_of_business) ?: $this->nature_of_business)
                : $this->nature_of_business,
            'status'               => $this->status,
            'shop_name'            => $this->shop_name,
            'ife_area'             => optional($this->area)->area,
            'location'             => $this->location,
            'problem_description'  => $this->problem_description,
            'support_required'     => $this->support_required,
            'support_description'  => $this->support_description,
            'personal_remarks'     => $this->personal_remarks,
            'pic_name'             => $this->pic_name,
            'mobile_number'        => $this->mobile_number,
            'other_mobile_numbers' => $this->other_mobile_numbers,
            'email'                => $this->email,
            'next_followup_date'   => $this->next_followup_date ? date('M j, Y', strtotime($this->next_followup_date)) : null,
            'next_followup_plan'   => $this->next_followup_plan,
            'photos'               => $this->documentUploads->map(fn ($document) => [
                'id'  => $document->id,
                'url' => $document->file_full_path,
            ])->values()->all(),
        ];
    }
}
