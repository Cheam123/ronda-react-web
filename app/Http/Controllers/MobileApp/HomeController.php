<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\GeneralSetting;
use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\OutletRecommendation;
use App\Models\Tasks;
use App\Models\User;
use App\Services\FormApprovalService;
use App\Services\FormRecordService;
use App\Services\Recommendation\RecommendationService;
use App\Services\TaskRisk;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class HomeController extends Controller
{
    /**
     * Provide a dashboard summary for the authenticated mobile user.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // 1. Active (new and in-progress) tasks the user can see
        $taskQuery = Tasks::visibleTo($user)->whereIn('status', [1, 2]);

        // 2. Get due ranges
        $today       = now()->toDateString();
        $startOfWeek = now()->startOfWeek();
        $endOfWeek   = now()->endOfWeek();

        $overdueCount  = (clone $taskQuery)->where('due_date', '<', $today)->count();
        $dueTodayCount = (clone $taskQuery)->where('due_date', $today)->count();
        $dueWeekCount  = (clone $taskQuery)->whereBetween('due_date', [$startOfWeek, $endOfWeek])->count();

        // 3. Determine Task Subtitle
        $subtitle = "You have {$overdueCount} tasks overdue !";
        if ($dueTodayCount > 0) {
            $subtitle = $dueTodayCount === 1 ? "You have {$dueTodayCount} task due today" : "You have {$dueTodayCount} tasks due today";
        } elseif ($dueWeekCount > 0) {
            $subtitle = $dueWeekCount === 1 ? "You have {$dueWeekCount} task due this week" : "You have {$dueWeekCount} tasks due this week";
        }

        // 4. User permissions — decided by user type (Admin / Manager / User)
        $listOfPermissions = $user->abilities();
        $listOfPermissions['can_assign_subscribers'] = $user->can('create_task');

        $data = [
            'salesTasks'        => [
                'count'    => $dueTodayCount === 0 ? $dueWeekCount : $dueTodayCount,
                'subtitle' => $subtitle
            ],
            'listOfPermissions' => $listOfPermissions,
            'today'             => $this->dayAtAGlance($user),
        ];

        return $this->response_ok($data, 'Dashboard summary retrieved successfully.');
    }

    /**
     * Day at a glance: the caller's OWN work for today (tasks they take part
     * in, visits they planned, form steps waiting on them), whatever their
     * role. The counts above keep their existing, role-scoped meaning.
     */
    private function dayAtAGlance(User $user): array
    {
        $now   = Carbon::now();
        $today = $now->toDateString();
        $risk  = TaskRisk::fromConfig();

        $mine = Tasks::whereHas('users', fn ($q) => $q->where('user_id', $user->id))
            ->with('lead:id,name,business_name');

        $taskRow = function (Tasks $task) use ($risk, $now) {
            $assessment = $risk->assessTask($task, $now);

            return [
                'id'             => $task->id,
                'reference'      => $task->task_reference,
                'title'          => $task->title,
                'lead_id'        => $task->lead_id,
                'lead_name'      => optional($task->lead)->business_name ?: optional($task->lead)->name,
                'status'         => $task->status,
                'status_label'   => Tasks::getTaskStatus($task->status),
                'due_date'       => $task->due_date,
                'due_time'       => $task->due_time,
                'appointment_at' => $task->appointment_date ? Carbon::parse($task->appointment_date)->toDateTimeString() : null,
                'risk'           => $assessment['level'],
                'risk_reason'    => $assessment['reason'],
            ];
        };

        $dueToday = (clone $mine)
            ->whereIn('status', TaskRisk::OPEN_STATUSES)
            ->whereDate('due_date', $today)
            ->orderBy('due_time')
            ->limit(20)
            ->get()
            ->map($taskRow)
            ->values();

        $appointments = (clone $mine)
            ->whereIn('status', [1, 2, 8])
            ->whereDate('appointment_date', $today)
            ->orderBy('appointment_date')
            ->limit(20)
            ->get()
            ->map($taskRow)
            ->values();

        // Every open task with its assessment, most urgent first: overdue,
        // then at risk, each by due time.
        $assessed = (clone $mine)
            ->whereIn('status', TaskRisk::OPEN_STATUSES)
            ->get()
            ->map(fn (Tasks $task) => ['task' => $task, 'risk' => $risk->assessTask($task, $now)])
            ->filter(fn ($row) => $row['risk']['level'] !== TaskRisk::ON_TRACK)
            ->sortBy(fn ($row) => [
                $row['risk']['level'] === TaskRisk::OVERDUE ? 0 : 1,
                optional($row['risk']['due_at'])->getTimestamp() ?? PHP_INT_MAX,
            ])
            ->values();

        // at_risk keeps its meaning (overdue included); overdue is the subset.
        $atRisk       = $assessed->count();
        $overdueCount = $assessed->where('risk.level', TaskRisk::OVERDUE)->count();

        $overdue = $assessed->where('risk.level', TaskRisk::OVERDUE)
            ->take(20)
            ->map(fn ($row) => $taskRow($row['task']))
            ->values();

        $atRiskOnly = $assessed->where('risk.level', TaskRisk::AT_RISK)
            ->take(20)
            ->map(fn ($row) => $taskRow($row['task']))
            ->values();

        // Follow-up visits the caller planned for today in an earlier IFE report.
        $visits = IFEReport::where('created_by', $user->id)
            ->whereDate('next_followup_date', $today)
            ->orderBy('id')
            ->limit(20)
            ->get()
            ->map(fn (IFEReport $report) => [
                'ife_report_id' => $report->id,
                'lead_id'       => $report->lead_id,
                'outlet'        => $report->shop_name ?: $report->company_name,
                'plan'          => $report->next_followup_plan,
                'location'      => $report->location,
            ])
            ->values();

        // Service jobs: form steps (fill / approval) waiting on the caller.
        try {
            $records   = app(FormRecordService::class);
            $formSteps = app(FormApprovalService::class)->pendingFor($user)
                ->take(20)
                ->map(fn ($submission) => [
                    'entry_id'     => $submission->id,
                    'record_title' => $records->titleFor($submission),
                    'reference'    => $submission->recordReference(),
                    'form_name'    => optional($submission->form)->name,
                    'stage_name'   => optional($submission->currentStage())->name,
                    'stage_type'   => optional($submission->currentStage())->node_type,
                    'submitted_at' => optional($submission->created_at)->toDateTimeString(),
                ])
                ->values();
        } catch (\Throwable $e) {
            Log::warning('Mobile home: form steps unavailable', ['error' => $e->getMessage()]);
            $formSteps = collect();
        }

        return [
            'date'           => $today,
            'counts'         => [
                'tasks_due'      => $dueToday->count(),
                'appointments'   => $appointments->count(),
                'visits_planned' => $visits->count(),
                'form_steps'     => $formSteps->count(),
                'at_risk'        => $atRisk,
                'overdue'        => $overdueCount,
            ],
            'tasks_due'      => $dueToday,
            'appointments'   => $appointments,
            'visits_planned' => $visits,
            'form_steps'     => $formSteps,
            // Open tasks past their due time, and those at risk but not yet
            // overdue (same row shape as tasks_due), most urgent first.
            'overdue'        => $overdue,
            'at_risk'        => $atRiskOnly,
            // A rep's outlets that could order more ("Suggested orders" card).
            'suggestions'    => $this->suggestionsFor($user),
        ];
    }

    /**
     * The Suggested orders card on a rep's Today: how many of their outlets
     * could order more, and roughly how much a month. Null for people who
     * see every outlet (the card is a rep's), or when nothing is computed.
     */
    private function suggestionsFor(User $user): ?array
    {
        if ($user->seesAllRecords()) {
            return null;
        }

        try {
            $top = app(RecommendationService::class)->topForUser($user, 5);
            $all = OutletRecommendation::query()
                ->whereIn('lead_id', Leads::visibleTo($user)->select('id'))
                ->where('estimated_monthly_value', '>', 0);

            return [
                'outlets'                 => $top['outlets'],
                'total'                   => $top['total'],
                'estimated_monthly_value' => round((float) $all->sum('estimated_monthly_value'), 2),
                'currency'                => config('ife.currency', 'RM'),
            ];
        } catch (\Throwable $e) {
            Log::warning('Mobile home: suggestions unavailable', ['error' => $e->getMessage()]);

            return null;
        }
    }

    public function getLifeVersion(Request $request)
    {
        $lifeVersion = GeneralSetting::where('key', 'life_version')->value('value');
        // The oldest build still allowed to run. Sent alongside the current
        // version so one call answers both "is there an update?" and "must I
        // take it before going any further?".
        $minVersion  = GeneralSetting::where('key', 'min_version')->value('value');

        return $this->response_ok([
            'life_version' => $lifeVersion,
            'min_version'  => $minVersion,
        ], 'Life app version retrieved successfully.');
    }

    public function getAppDownloadLink(Request $request)
    {
        $downloadLink = GeneralSetting::where('key', 'life_app_download_link')->value('value');

        return $this->response_ok(['download_link' => $downloadLink], 'Life app download link retrieved successfully.');
    }

}
