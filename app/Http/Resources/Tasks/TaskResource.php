<?php

namespace App\Http\Resources\Tasks;

use App\Http\Resources\DocumentResource;
use App\Models\Tasks;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * A task for its view and edit pages.
 *
 * ROLE: 1 creator, 2 subscriber, 3 checker, 4 owner, 5 viewer, 6 sub-subscriber
 *
 * @mixin Tasks
 */
class TaskResource extends JsonResource
{
    public function toArray($request): array
    {
        $appointment = $this->appointment_date ? Carbon::parse($this->appointment_date) : null;
        $holder      = fn (int $role) => $this->users->firstWhere('role', $role);
        $idsFor      = fn (int $role) => $this->users->where('role', $role)->pluck('user_id')->values()->all();

        return [
            'id'               => $this->id,
            'reference'        => $this->task_reference,
            'status'           => (int) $this->status,
            'status_label'     => Tasks::getTaskStatus($this->status),
            'title'            => $this->title,
            'alert'            => $this->alert,
            'start_date'       => $this->start_date,
            'start_time'       => $this->start_time,
            'due_date'         => $this->due_date,
            'due_time'         => $this->due_time,
            'appointment_date' => optional($appointment)->format('Y-m-d'),
            'appointment_time' => optional($appointment)->format('H:i:s'),
            'invoice_no'       => $this->invoice_no,
            'sales'            => $this->sales,
            // Rich text (HTML) written in the editor.
            'remark'           => $this->remark,
            'people'           => [
                'subscriber'      => optional($holder(2))->user_id,
                'subscriber_name' => optional(optional($holder(2))->user)->name,
                'sub_subscribers' => $idsFor(6),
                'owners'          => $idsFor(4),
                'viewers'         => $idsFor(5),
                'creator'         => optional(optional($holder(1))->user)->name,
                'checker'         => optional(optional($holder(3))->user)->name,
            ],
            'lead'             => TaskLeadResource::make($this->lead)->resolve(),
            'documents'        => DocumentResource::collection(
                $this->lead->documentUploads->concat($this->documentUploads)
            )->resolve(),
        ];
    }
}
