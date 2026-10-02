<?php

namespace App\Services;

use App\Models\FormSubmission;
use App\Models\IFEReport;
use App\Models\Order;
use App\Models\Tasks;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The figures behind the web dashboard and the daily digest.
 *
 * summary(null) is the team view (Admins and Managers): every task, visit,
 * form and order, plus a per-person activity table. summary($user) is one
 * Field Rep's own work: tasks they take part in, visits and orders they
 * made, forms they submitted.
 *
 * "Last 7 days" is today and the six days before it.
 */
class DashboardService
{
    private TaskRisk $risk;

    public function __construct(?TaskRisk $risk = null)
    {
        $this->risk = $risk ?? TaskRisk::fromConfig();
    }

    public function summary(?User $forUser = null, ?Carbon $now = null): array
    {
        $now       = $now ? $now->copy() : Carbon::now();
        $today     = $now->toDateString();
        $weekStart = $now->copy()->subDays(6)->startOfDay();
        $month     = $now->copy()->startOfMonth();

        $open     = $this->openTasks($forUser, $now);
        $overdue  = $open->where('risk.level', TaskRisk::OVERDUE);
        $atRisk   = $open->where('risk.level', TaskRisk::AT_RISK);

        $tasks = $this->taskScope($forUser);

        $forms = FormSubmission::query()
            ->when($forUser, fn ($q) => $q->where('submitted_by', $forUser->id))
            ->where('created_at', '>=', $weekStart)
            ->get(['id', 'status', 'submitted_by', 'created_at']);

        $visits = IFEReport::query()
            ->when($forUser, fn ($q) => $q->where('created_by', $forUser->id))
            ->where('created_at', '>=', $weekStart)
            ->get(['id', 'created_by', 'created_at']);

        $monthOrders = Order::confirmed()
            ->when($forUser, fn ($q) => $q->where('created_by', $forUser->id))
            ->where('order_date', '>=', $month->toDateString())
            ->get(['id', 'created_by', 'order_date', 'total_amount']);

        $weekOrders = Order::confirmed()
            ->when($forUser, fn ($q) => $q->where('created_by', $forUser->id))
            ->where('order_date', '>=', $weekStart->toDateString())
            ->sum('total_amount');

        // The same days of last month, capped at that month's end.
        $previousFrom  = $month->copy()->subMonthNoOverflow();
        $previousTo    = $previousFrom->copy()->addDays($now->day - 1)->min($previousFrom->copy()->endOfMonth());
        $previousValue = (float) Order::confirmed()
            ->when($forUser, fn ($q) => $q->where('created_by', $forUser->id))
            ->whereBetween('order_date', [$previousFrom->toDateString(), $previousTo->toDateString()])
            ->sum('total_amount');
        $monthValue = round((float) $monthOrders->sum('total_amount'), 2);

        $visitsByDay = $visits->countBy(fn ($visit) => $visit->created_at->toDateString());
        $visitDays   = [];
        for ($day = $weekStart->copy(); $day->lte($now); $day->addDay()) {
            $visitDays[] = ['date' => $day->toDateString(), 'count' => (int) ($visitsByDay[$day->toDateString()] ?? 0)];
        }

        return [
            'scope'        => $forUser ? 'personal' : 'team',
            'generated_at' => $now->toIso8601String(),
            'tasks'        => [
                'open'         => $open->count(),
                'new'          => $open->where('task.status', 1)->count(),
                'in_progress'  => $open->where('task.status', 2)->count(),
                'overdue'      => $overdue->count(),
                'at_risk'      => $atRisk->count(),
                'due_today'    => $open->filter(fn ($row) => $this->dateOf($row['task']->due_date) === $today)->count(),
                'created_7d'   => (clone $tasks)->where('creation_date', '>=', $weekStart)->count(),
                'done_7d'      => (clone $tasks)->where('done_date', '>=', $weekStart)->count(),
                'completed_7d' => (clone $tasks)->where('complete_date', '>=', $weekStart)->count(),
            ],
            'forms'        => [
                'submitted_7d' => $forms->count(),
                'pending'      => $forms->where('status', 'pending')->count(),
                'approved'     => $forms->where('status', 'approved')->count(),
                'rejected'     => $forms->where('status', 'rejected')->count(),
            ],
            'visits'       => [
                'last_7d' => $visits->count(),
                'today'   => $visits->filter(fn ($visit) => $visit->created_at->toDateString() === $today)->count(),
                'daily'   => $visitDays,
            ],
            'orders'       => [
                'month_count' => $monthOrders->count(),
                'month_value' => $monthValue,
                'last_7d'     => round((float) $weekOrders, 2),
                'change_pct'  => $previousValue > 0 ? round(($monthValue - $previousValue) / $previousValue * 100, 1) : null,
            ],
            'attention'    => $this->attentionList($open),
            'trend'        => $this->trend($forUser, $now),
            'team'         => $forUser ? [] : $this->teamActivity($open, $weekStart),
        ];
    }

    /** How many open tasks are overdue and at risk, for badges outside the dashboard. */
    public function riskCounts(?User $forUser = null, ?Carbon $now = null): array
    {
        $open = $this->openTasks($forUser, $now ? $now->copy() : Carbon::now());

        return [
            'overdue' => $open->where('risk.level', TaskRisk::OVERDUE)->count(),
            'at_risk' => $open->where('risk.level', TaskRisk::AT_RISK)->count(),
        ];
    }

    /** Tasks in scope: all of them for the team view, the ones the user takes part in otherwise. */
    private function taskScope(?User $forUser)
    {
        return Tasks::query()->when(
            $forUser,
            fn ($q) => $q->whereHas('users', fn ($users) => $users->where('user_id', $forUser->id))
        );
    }

    /**
     * Open tasks, each with its risk assessment.
     *
     * @return Collection<int, array{task: Tasks, risk: array}>
     */
    private function openTasks(?User $forUser, Carbon $now): Collection
    {
        return $this->taskScope($forUser)
            ->whereIn('status', TaskRisk::OPEN_STATUSES)
            ->with(['lead:id,name,business_name', 'users.user:id,name'])
            ->get()
            ->map(fn (Tasks $task) => ['task' => $task, 'risk' => $this->risk->assessTask($task, $now)]);
    }

    /** Overdue first, then at risk; soonest due first within each. */
    private function attentionList(Collection $open, int $limit = 10): array
    {
        return $open
            ->filter(fn ($row) => $row['risk']['level'] !== TaskRisk::ON_TRACK)
            ->sortBy(fn ($row) => [
                $row['risk']['level'] === TaskRisk::OVERDUE ? 0 : 1,
                optional($row['risk']['due_at'])->getTimestamp() ?? PHP_INT_MAX,
            ])
            ->take($limit)
            ->map(fn ($row) => [
                'id'         => $row['task']->id,
                'reference'  => $row['task']->task_reference,
                'title'      => $row['task']->title,
                'lead'       => optional($row['task']->lead)->business_name ?: optional($row['task']->lead)->name,
                'subscriber' => optional(optional($row['task']->users->firstWhere('role', 2))->user)->name,
                'status'     => Tasks::getTaskStatus($row['task']->status),
                'level'      => $row['risk']['level'],
                'reason'     => $row['risk']['reason'],
                'due_at'     => optional($row['risk']['due_at'])->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /** Tasks created vs. tasks marked done per day, last 14 days. */
    private function trend(?User $forUser, Carbon $now): array
    {
        $from    = $now->copy()->subDays(13)->startOfDay();
        $created = $this->taskScope($forUser)->where('creation_date', '>=', $from)->pluck('creation_date');
        $done    = $this->taskScope($forUser)->where('done_date', '>=', $from)->pluck('done_date');

        $countByDay = fn ($dates) => collect($dates)->countBy(fn ($date) => Carbon::parse($date)->toDateString());
        $createdBy  = $countByDay($created);
        $doneBy     = $countByDay($done);

        $days = [];
        for ($day = $from->copy(); $day->lte($now); $day->addDay()) {
            $key    = $day->toDateString();
            $days[] = [
                'date'    => $key,
                'created' => (int) ($createdBy[$key] ?? 0),
                'done'    => (int) ($doneBy[$key] ?? 0),
            ];
        }

        return $days;
    }

    /**
     * One row per active non-admin user: open work, overdue and at-risk
     * tasks (as subscriber / sub-subscriber), and what they did this week.
     */
    private function teamActivity(Collection $open, Carbon $weekStart): array
    {
        $people = User::where('status', 1)
            ->where('type', '!=', User::TYPE_ADMIN)
            ->orderBy('name')
            ->get(['id', 'name', 'type']);

        $openBy = [];
        foreach ($open as $row) {
            $holders = $row['task']->users->whereIn('role', [2, 6])->pluck('user_id')->unique();
            foreach ($holders as $userId) {
                $openBy[$userId]['open']    = ($openBy[$userId]['open'] ?? 0) + 1;
                $openBy[$userId]['overdue'] = ($openBy[$userId]['overdue'] ?? 0) + ($row['risk']['level'] === TaskRisk::OVERDUE ? 1 : 0);
                $openBy[$userId]['at_risk'] = ($openBy[$userId]['at_risk'] ?? 0) + ($row['risk']['level'] === TaskRisk::AT_RISK ? 1 : 0);
            }
        }

        $doneBy = [];
        Tasks::where('done_date', '>=', $weekStart)->with('users')->get()->each(function (Tasks $task) use (&$doneBy) {
            foreach ($task->users->whereIn('role', [2, 6])->pluck('user_id')->unique() as $userId) {
                $doneBy[$userId] = ($doneBy[$userId] ?? 0) + 1;
            }
        });

        $visitsBy = IFEReport::where('created_at', '>=', $weekStart)->get(['created_by'])->countBy('created_by');
        $formsBy  = FormSubmission::where('created_at', '>=', $weekStart)->get(['submitted_by'])->countBy('submitted_by');
        $ordersBy = Order::confirmed()->where('order_date', '>=', $weekStart->toDateString())
            ->get(['created_by', 'total_amount'])
            ->groupBy('created_by')
            ->map(fn ($orders) => round((float) $orders->sum('total_amount'), 2));

        return $people->map(fn (User $person) => [
            'user_id'      => $person->id,
            'name'         => $person->name,
            'role'         => User::getUserType($person->type),
            'open'         => $openBy[$person->id]['open'] ?? 0,
            'overdue'      => $openBy[$person->id]['overdue'] ?? 0,
            'at_risk'      => $openBy[$person->id]['at_risk'] ?? 0,
            'done_7d'      => $doneBy[$person->id] ?? 0,
            'visits_7d'    => (int) ($visitsBy[$person->id] ?? 0),
            'forms_7d'     => (int) ($formsBy[$person->id] ?? 0),
            'orders_7d'    => (float) ($ordersBy[$person->id] ?? 0),
        ])->values()->all();
    }

    private function dateOf($value): ?string
    {
        return $value ? Carbon::parse($value)->toDateString() : null;
    }
}
