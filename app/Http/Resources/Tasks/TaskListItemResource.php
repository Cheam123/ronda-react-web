<?php

namespace App\Http\Resources\Tasks;

use App\Helpers\Helper;
use App\Models\Tasks;
use App\Models\User;
use App\Services\TaskRisk;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A row of the task list, with everything its activity panel (Activity
 * and Details tabs) shows.
 *
 * ROLE: 1 creator, 2 subscriber, 3 checker, 4 owner, 5 viewer, 6 sub-subscriber
 *
 * @mixin Tasks
 */
class TaskListItemResource extends JsonResource
{
    private const DATE_TIME = 'j M Y, g:i a';

    public function toArray($request): array
    {
        /** @var User $user */
        $user       = $request->user();
        $subscriber = $this->users->firstWhere('role', 2);
        $reminder   = $this->reminder->where('user_id', $user->id)->first();
        $comments   = $this->comments->sortByDesc('created_at')->values();
        $namesFor   = fn (int $role) => $this->users->where('role', $role)
            ->map(fn ($taskUser) => optional($taskUser->user)->name)
            ->filter()
            ->values()
            ->all();

        return [
            'id'           => $this->id,
            'reference'    => $this->task_reference,
            'title'        => $this->title,
            'flagged'      => $this->alert == 2,
            'status'       => (int) $this->status,
            'status_label' => Tasks::getTaskStatus($this->status),
            'due'          => $this->due(),
            'appointment'  => $this->format($this->appointment_date),
            'reminder'     => $reminder ? $this->format($reminder->reminder_date . ' ' . $reminder->reminder_time) : null,
            'created_at'   => $this->format($this->created_at),
            'last_updated' => $this->format($this->last_follow_up),
            'aging'        => $this->aging(),
            'sales'        => $this->sales > 0 ? 'RM ' . number_format($this->sales, 2) : null,
            'lead'         => [
                'id'            => $this->lead_id,
                'name'          => optional($this->lead)->name,
                'mobile'        => optional($this->lead)->mobile,
                'customer_id'   => optional($this->lead)->customer_id,
                'business_name' => optional($this->lead)->business_name,
                'ife_area'      => optional(optional($this->lead)->ifearea)->area,
                'source'        => Helper::getLeadSource(optional($this->lead)->source),
            ],
            'subscriber'   => $subscriber ? [
                'id'           => $subscriber->user_id,
                'name'         => optional($subscriber->user)->name,
                'initials'     => $this->initials(optional($subscriber->user)->name),
                'rate'         => optional($this->rating->where('user_id', $subscriber->user_id)->first())->rate,
                // [date, outlet] of each open appointment the subscriber has.
                'appointments' => optional($subscriber->user)->active_appointment ?? [],
            ] : null,
            'sub_subscribers' => $namesFor(6),
            'owners'          => $namesFor(4),
            'activities'      => TaskCommentResource::collection($comments)->resolve(),
            'can'             => $this->permissionsFor($user),
        ];
    }

    /**
     * What the signed-in user may do from the list. The controller actions
     * still check their own permissions; these only decide what to show.
     */
    private function permissionsFor(User $user): array
    {
        $hasRole = fn (array $roles) => $this->users->whereIn('role', $roles)->where('user_id', $user->id)->isNotEmpty();
        $status  = (int) $this->status;

        return [
            'edit'       => in_array($status, [1, 2, 3, 4, 8], true) && ($hasRole([1, 3, 4]) || $user->type === User::TYPE_ADMIN),
            'delete'     => ($status === 1 && $hasRole([1, 4])) || ($status === 2 && $user->type === User::TYPE_MANAGER),
            // A Keep-In-View task is brought back through its edit page.
            'recycle'    => $status === 6 && ($hasRole([4]) || in_array($user->type, [User::TYPE_MANAGER, User::TYPE_USER], true)),
            // An On Hold task is reactivated in place.
            'reactivate' => $status === 8 && ($hasRole([2]) || in_array($user->type, [User::TYPE_MANAGER, User::TYPE_USER], true)),
        ];
    }

    /**
     * How stale the task's last follow-up is: tone picks the Last contact
     * chip's colour, label is what it says. A flagged task is always red.
     */
    private function aging(): array
    {
        $last      = $this->last_follow_up ? strtotime($this->last_follow_up) : null;
        $daysSince = $last ? (int) floor((time() - $last) / 86400) : null;

        if ($daysSince === null) {
            [$tone, $label] = ['warn', 'No contact'];
        } elseif ($daysSince <= 1) {
            [$tone, $label] = ['good', $daysSince === 0 ? 'Today' : 'Yesterday'];
        } elseif ($daysSince <= 3) {
            [$tone, $label] = ['good', $daysSince . ' days ago'];
        } elseif ($daysSince <= 7) {
            [$tone, $label] = ['warn', $daysSince . ' days ago'];
        } else {
            [$tone, $label] = ['danger', 'Stale · ' . $daysSince . ' days'];
        }

        if ($this->alert == 2) {
            $tone = 'danger';
        }

        return ['tone' => $tone, 'label' => $label];
    }

    /**
     * The due date and time apart, for the list's Due column. Overdue is
     * TaskRisk's rule: past due while the task is still New or In Progress.
     */
    private function due(): ?array
    {
        $at = TaskRisk::combine($this->due_date, $this->due_time, '23:59:59');

        if (!$at) {
            return null;
        }

        return [
            'date'    => $at->format('j M Y'),
            'time'    => $this->due_time ? $at->format('g:i a') : null,
            'overdue' => in_array((int) $this->status, TaskRisk::OPEN_STATUSES, true) && $at->isPast(),
        ];
    }

    /** "Aiman Rahman" -> "AR" */
    private function initials(?string $name): string
    {
        if (!$name) {
            return '?';
        }

        $words = explode(' ', $name);
        $first = preg_replace('/[^A-Za-z]/', '', $words[0] ?? '');
        $last  = preg_replace('/[^A-Za-z]/', '', $words[1] ?? '');

        return strtoupper(substr($first, 0, 1) . substr($last, 0, 1));
    }

    private function format($value): ?string
    {
        return $value ? date(self::DATE_TIME, strtotime($value)) : null;
    }
}
