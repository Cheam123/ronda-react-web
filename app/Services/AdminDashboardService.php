<?php

namespace App\Services;

use App\Models\DailyDigest;
use App\Models\FormSubmission;
use App\Models\IfeArea;
use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OutletRecommendation;
use App\Models\Product;
use App\Models\TaskHistory;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The figures behind the admin dashboard: sales, outlets, people, the
 * catalogue and the scheduled jobs across the whole organisation. The team's
 * open work stays on the team dashboard (DashboardService).
 *
 * "This month" runs from the 1st to today and is compared with the same
 * days of last month.
 */
class AdminDashboardService
{
    /** Pending form submissions older than this are called out. */
    public const SLOW_APPROVAL_HOURS = 48;

    /** When the jobs run (App\Console\Kernel::schedule()). */
    public const DIGEST_SCHEDULE          = '7:00 AM';
    public const RECOMMENDATIONS_SCHEDULE = '2:45 AM';

    public function summary(User $viewer, ?Carbon $now = null): array
    {
        $now    = $now ? $now->copy() : Carbon::now();
        $people = $this->people($viewer);

        return [
            'generated_at'   => $now->toIso8601String(),
            'sales'          => $this->sales($now),
            'outlets'        => $this->outlets($now),
            'people'         => $people,
            'approvals'      => $this->approvals($now),
            'stale_products' => Product::stale($now)->orderBy('name')->pluck('name')->all(),
            'areas'          => $this->areas($now),
            'activity'       => $this->activity(),
            'automations'    => $this->automations($people, $now),
        ];
    }

    /** Confirmed orders this month: the total, a daily series, and where the money came from. */
    private function sales(Carbon $now): array
    {
        $from   = $now->copy()->startOfMonth();
        $orders = Order::confirmed()
            ->whereBetween('order_date', [$from->toDateString(), $now->toDateString()])
            ->get(['id', 'lead_id', 'order_date', 'total_amount']);

        // The same days of last month, capped at that month's end (31 Mar -> 28 Feb).
        $previousFrom = $from->copy()->subMonthNoOverflow();
        $previousTo   = $previousFrom->copy()->addDays($now->day - 1)->min($previousFrom->copy()->endOfMonth());
        $previous     = round((float) Order::confirmed()
            ->whereBetween('order_date', [$previousFrom->toDateString(), $previousTo->toDateString()])
            ->sum('total_amount'), 2);

        $value = round((float) $orders->sum('total_amount'), 2);
        $byDay = $orders
            ->groupBy(fn (Order $order) => $order->order_date->toDateString())
            ->map(fn (Collection $day) => (float) $day->sum('total_amount'));

        $daily = [];
        for ($day = $from->copy(); $day->lte($now); $day->addDay()) {
            $daily[] = ['date' => $day->toDateString(), 'value' => round($byDay[$day->toDateString()] ?? 0, 2)];
        }

        $lines = OrderLine::query()
            ->join('orders', 'orders.id', '=', 'order_lines.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_lines.product_id')
            ->where('orders.status', Order::STATUS_CONFIRMED)
            ->whereNull('orders.deleted_at')
            ->whereBetween('orders.order_date', [$from->toDateString(), $now->toDateString()])
            ->get([
                'order_lines.product_id',
                'order_lines.quantity',
                'order_lines.line_total',
                'products.name',
                'products.sku',
                'products.unit',
                'products.category',
            ]);

        $categories = $lines
            ->groupBy(fn ($line) => $line->category ?: 'Uncategorised')
            ->map(fn (Collection $group, string $name) => ['name' => $name, 'value' => round((float) $group->sum('line_total'), 2)])
            ->sortByDesc('value')
            ->values()
            ->all();

        $topProducts = $lines
            ->groupBy('product_id')
            ->map(fn (Collection $group) => [
                'id'       => $group->first()->product_id,
                'name'     => $group->first()->name,
                'sku'      => $group->first()->sku,
                'unit'     => $group->first()->unit,
                'quantity' => round((float) $group->sum('quantity'), 2),
                'value'    => round((float) $group->sum('line_total'), 2),
            ])
            ->sortByDesc('value')
            ->take(5)
            ->values()
            ->all();

        return [
            'month_value'    => $value,
            'month_count'    => $orders->count(),
            'month_outlets'  => $orders->pluck('lead_id')->unique()->count(),
            'previous_value' => $previous,
            'change_pct'     => $previous > 0 ? round(($value - $previous) / $previous * 100, 1) : null,
            'daily'          => $daily,
            'categories'     => $categories,
            'top_products'   => $topProducts,
        ];
    }

    private function outlets(Carbon $now): array
    {
        $isCustomer = fn ($query) => $query->whereNotNull('customer_id')->where('customer_id', '!=', '');
        $noArea     = Leads::whereNull('ife_area_id');

        return [
            'total'        => Leads::count(),
            'customers'    => Leads::where($isCustomer)->count(),
            'new_month'    => Leads::where('created_at', '>=', $now->copy()->startOfMonth())->count(),
            'without_area' => (clone $noArea)->count(),
            'without_area_names' => (clone $noArea)->orderBy('business_name')->take(2)->get(['name', 'business_name'])
                ->map(fn (Leads $lead) => $lead->business_name ?: $lead->name)
                ->all(),
        ];
    }

    /** Active users, admins first. */
    private function people(User $viewer): array
    {
        return User::where('status', 1)
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'name', 'type', 'telegram_chat_id', 'fcm_token', 'enable_notification'])
            ->map(fn (User $user) => [
                'id'       => $user->id,
                'name'     => $user->name,
                'type'     => (int) $user->type,
                'role'     => User::getUserType($user->type),
                'telegram' => filled($user->telegram_chat_id),
                'push'     => filled($user->fcm_token) && (bool) $user->enable_notification,
                'is_you'   => $user->id === $viewer->id,
            ])
            ->values()
            ->all();
    }

    /** Form submissions waiting on an approver (closed records excluded). */
    private function approvals(Carbon $now): array
    {
        $pending = FormSubmission::where('status', 'pending')
            ->where(fn ($query) => $query->whereNull('record_status')->orWhere('record_status', '!=', 'closed'))
            ->get(['id', 'form_id', 'created_at']);

        $slowBefore = $now->copy()->subHours(self::SLOW_APPROVAL_HOURS);
        $oldest     = $pending->min('created_at');

        return [
            'pending'   => $pending->count(),
            'forms'     => $pending->pluck('form_id')->unique()->count(),
            'slow'      => $pending->filter(fn (FormSubmission $submission) => $submission->created_at->lt($slowBefore))->count(),
            'oldest_at' => $oldest ? Carbon::parse($oldest)->toIso8601String() : null,
        ];
    }

    /** Outlets per IFE area, and the IFE reports filed there this month. */
    private function areas(Carbon $now): array
    {
        $outlets = Leads::whereNotNull('ife_area_id')
            ->selectRaw('ife_area_id, COUNT(*) AS total')
            ->groupBy('ife_area_id')
            ->pluck('total', 'ife_area_id');

        $reports = IFEReport::whereNotNull('ife_area')
            ->where('created_at', '>=', $now->copy()->startOfMonth())
            ->selectRaw('ife_area, COUNT(*) AS total')
            ->groupBy('ife_area')
            ->pluck('total', 'ife_area');

        return IfeArea::orderBy('area')->get(['id', 'area'])
            ->map(fn (IfeArea $area) => [
                'id'            => $area->id,
                'name'          => $area->area,
                'outlets'       => (int) ($outlets[$area->id] ?? 0),
                'reports_month' => (int) ($reports[$area->id] ?? 0),
            ])
            ->sortBy([['outlets', 'desc'], ['name', 'asc']])
            ->values()
            ->all();
    }

    /** The latest orders, visits, form submissions and finished tasks, newest first. */
    private function activity(int $limit = 8): array
    {
        $outlet = fn ($lead) => $lead ? ($lead->business_name ?: $lead->name) : 'an outlet';

        $orders = Order::with(['lead:id,name,business_name', 'createdBy:id,name'])
            ->latest()->take($limit)->get()
            ->map(fn (Order $order) => [
                'at'     => $order->created_at,
                'kind'   => 'order',
                'who'    => optional($order->createdBy)->name,
                'what'   => 'recorded order ' . $order->order_no . ' for ' . $outlet($order->lead),
                'amount' => $order->isCancelled() ? null : (float) $order->total_amount,
            ]);

        $visits = IFEReport::with(['lead:id,name,business_name', 'createdBy:id,name'])
            ->latest()->take($limit)->get()
            ->map(fn (IFEReport $report) => [
                'at'     => $report->created_at,
                'kind'   => 'visit',
                'who'    => optional($report->createdBy)->name,
                'what'   => 'filed an IFE report for ' . $outlet($report->lead),
                'amount' => null,
            ]);

        $forms = FormSubmission::with(['form:id,name', 'submittedBy:id,name'])
            ->latest()->take($limit)->get()
            ->map(fn (FormSubmission $submission) => [
                'at'     => $submission->created_at,
                'kind'   => 'form',
                'who'    => optional($submission->submittedBy)->name,
                'what'   => 'submitted ' . (optional($submission->form)->name ?? 'a form'),
                'amount' => null,
            ]);

        $done = TaskHistory::with(['task:id,task_reference,title', 'updatedBy:id,name'])
            ->where('after_status', 3)
            ->latest('created_at')->take($limit)->get()
            ->map(fn (TaskHistory $history) => [
                'at'     => $history->created_at,
                'kind'   => 'task',
                'who'    => optional($history->updatedBy)->name,
                'what'   => 'marked ' . (optional($history->task)->task_reference ?? 'a task') . ' done',
                'amount' => null,
            ]);

        return $orders->concat($visits)->concat($forms)->concat($done)
            ->filter(fn (array $event) => $event['at'] !== null)
            ->map(fn (array $event) => ['at' => Carbon::parse($event['at'])] + $event)
            ->sortByDesc(fn (array $event) => $event['at']->getTimestamp())
            ->take($limit)
            ->map(fn (array $event) => ['at' => $event['at']->toIso8601String()] + $event)
            ->values()
            ->all();
    }

    /** The scheduled jobs an admin looks after, and how notifications reach people. */
    private function automations(array $people, Carbon $now): array
    {
        $digest = DailyDigest::latestDigest();

        $recommendations = OutletRecommendation::query()
            ->selectRaw('COUNT(*) AS outlets, SUM(gap_count) AS gaps, SUM(estimated_monthly_value) AS value, MAX(computed_at) AS last_run')
            ->first();
        $lastRun = $recommendations && $recommendations->last_run ? Carbon::parse($recommendations->last_run) : null;

        return [
            'digest'          => [
                'schedule' => self::DIGEST_SCHEDULE,
                'ran_at'   => $digest ? $digest->updated_at->toIso8601String() : null,
                'today'    => $digest !== null && $digest->digest_date->isSameDay($now),
                'source'   => optional($digest)->source,
                'error'    => optional($digest)->error,
            ],
            'recommendations' => [
                'schedule' => self::RECOMMENDATIONS_SCHEDULE,
                'ran_at'   => optional($lastRun)->toIso8601String(),
                'fresh'    => $lastRun !== null && $lastRun->gte($now->copy()->subHours(26)),
                'outlets'  => (int) optional($recommendations)->outlets,
                'gaps'     => (int) optional($recommendations)->gaps,
                'value'    => round((float) optional($recommendations)->value, 2),
            ],
            'notifications'   => [
                'users'    => count($people),
                'telegram' => count(array_filter($people, fn (array $person) => $person['telegram'])),
                'push'     => count(array_filter($people, fn (array $person) => $person['push'])),
            ],
        ];
    }
}
