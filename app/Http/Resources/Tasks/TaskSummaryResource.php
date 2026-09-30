<?php

namespace App\Http\Resources\Tasks;

use App\Helpers\Helper;
use App\Models\Tasks;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A task as one row of a lead's "Task Histories": what it is, who handles
 * it (by role) and where it stands.
 *
 * ROLE: 1 creator, 2 subscriber, 3 checker, 4 owner, 5 viewer, 6 sub-subscriber
 *
 * @mixin Tasks
 */
class TaskSummaryResource extends JsonResource
{
    /** The date each status was reached, by status. */
    private const STATUS_DATES = [
        1 => 'created_at',
        2 => 'inprogress_date',
        3 => 'done_date',
        4 => 'verify_date',
        5 => 'complete_date',
        6 => 'kiv_date',
        7 => 'reject_date',
    ];

    public function toArray($request): array
    {
        $namesFor = fn (int $role) => $this->users->where('role', $role)
            ->map(fn ($taskUser) => optional($taskUser->user)->name)
            ->filter()
            ->values()
            ->all();

        return [
            'id'                => $this->id,
            'reference'         => $this->task_reference,
            'title'             => $this->title,
            'lead_source'       => Helper::getLeadSource(optional($this->lead)->source),
            'business_category' => Helper::getBusinessCategory(optional($this->lead)->business_category),
            'appointment'       => $this->formatDate($this->appointment_date),
            'status'            => $this->status,
            'status_label'      => Tasks::getTaskStatus($this->status),
            'status_date'       => isset(self::STATUS_DATES[$this->status])
                ? $this->formatDate($this->{self::STATUS_DATES[$this->status]})
                : null,
            'subscriber'        => $namesFor(2)[0] ?? null,
            'sub_subscribers'   => $namesFor(6),
            'checker'           => $namesFor(3)[0] ?? null,
            'creator'           => $namesFor(1)[0] ?? null,
            'owners'            => $namesFor(4),
            'last_updated'      => $this->lastUpdateBySubscriber(),
        ];
    }

    /**
     * When the task's first subscriber (or sub-subscriber) last posted an
     * update on it.
     */
    private function lastUpdateBySubscriber(): ?string
    {
        $holder = $this->users->whereIn('role', [2, 6])->first();

        if (!$holder) {
            return null;
        }

        $latest = $this->comments->where('submit_by', $holder->user_id)->sortByDesc('created_at')->first();

        return $latest ? $this->formatDate($latest->created_at) : null;
    }

    private function formatDate($value): ?string
    {
        return $value ? date('Y M d h:i A', strtotime($value)) : null;
    }
}
