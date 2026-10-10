<?php

namespace App\Services\Ai;

use App\Helpers\Helper;
use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OutletRecommendation;
use App\Models\Product;
use App\Models\Tasks;
use App\Services\Recommendation\RecommendationService;
use App\Services\TaskRisk;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * What the rep assistant knows about one outlet: its profile, its recent
 * visits and orders, its open tasks, its suggested orders and the product
 * catalogue. Built fresh for every call, so answers follow the records.
 *
 * Contact details (mobile numbers, email addresses, the street address) are
 * left out on purpose: Claude never needs them to help with a visit. The
 * person in charge's name from the latest visit stays, for greetings in
 * follow-up messages.
 */
class OutletContext
{
    public const VISITS = 5;
    public const ORDERS = 6;

    /** How `today` is written in the facts ("Monday, 5 Oct 2026"). */
    public const TODAY_FORMAT = 'l, j M Y';

    /** Catalogue descriptions are trimmed to this many characters. */
    private const DESCRIPTION_LIMIT = 300;

    public function __construct(private RecommendationService $recommendations)
    {
    }

    public function facts(Leads $lead, ?Carbon $now = null): array
    {
        $now = $now ? $now->copy() : Carbon::now();
        $lead->loadMissing('ifearea', 'assignee:id,name');

        $visits = IFEReport::where('lead_id', $lead->id)
            ->with('createdBy:id,name')
            ->orderByDesc('created_at')
            ->take(self::VISITS)
            ->get();

        $orders = Order::where('lead_id', $lead->id)
            ->with('lines.product:id,sku,name,unit')
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->take(self::ORDERS)
            ->get();

        $recommendation = $this->recommendations->forLead($lead, false);
        $suggestedIds   = array_column($recommendation['items'] ?? [], 'product_id');
        $orderedIds     = $orders->flatMap(fn (Order $order) => $order->lines->pluck('product_id'))->all();

        return [
            'today'            => $now->format(self::TODAY_FORMAT),
            'currency'         => config('ife.currency', 'RM'),
            'outlet'           => $this->outlet($lead),
            'person_in_charge' => optional($visits->first(fn (IFEReport $visit) => filled($visit->pic_name)))->pic_name,
            'visits'           => $visits->map(fn (IFEReport $visit) => $this->visit($visit))->values()->all(),
            'orders'           => $orders->map(fn (Order $order) => $this->order($order))->values()->all(),
            'order_summary'    => $this->orderSummary($lead, $now),
            'open_tasks'       => $this->openTasks($lead, $now),
            'suggested_orders' => $this->suggestions($recommendation),
            'catalogue'        => $this->catalogue(array_unique(array_merge($suggestedIds, $orderedIds))),
        ];
    }

    /**
     * Changes whenever something the facts are built from changes, and
     * every day (a brief says "5 days late", which is only true today).
     */
    public function hash(Leads $lead, ?Carbon $now = null): string
    {
        $latest = fn ($query) => [(clone $query)->count(), (string) (clone $query)->max('updated_at')];

        return hash('sha256', json_encode([
            ($now ?? Carbon::now())->toDateString(),
            (string) $lead->updated_at,
            $latest(IFEReport::where('lead_id', $lead->id)),
            $latest(Order::where('lead_id', $lead->id)),
            $latest(Tasks::where('lead_id', $lead->id)),
            OutletRecommendation::where('lead_id', $lead->id)->value('items_hash'),
        ]));
    }

    private function outlet(Leads $lead): array
    {
        return [
            'name'           => $lead->business_name ?: $lead->name,
            'company'        => $lead->name,
            'customer_id'    => $lead->customer_id,
            'status'         => $lead->customer_id ? 'customer' : 'prospect',
            'type'           => Helper::getBusinessCategory($lead->business_category) ?: null,
            'segment'        => Leads::segmentLabel($lead->segment),
            'size_band'      => Leads::sizeBandLabel($lead->size_band),
            'seats'          => $lead->seats,
            'area'           => optional($lead->ifearea)->area,
            'received_on'    => $lead->receiving_date ? Carbon::parse($lead->receiving_date)->format('j M Y') : null,
            'assigned_to'    => optional($lead->assignee)->name,
            'remark'         => $lead->remark,
        ];
    }

    private function visit(IFEReport $visit): array
    {
        $support = $visit->support_required && !in_array(strtolower($visit->support_required), ['n/a', 'no', 'none'], true)
            ? trim($visit->support_required . ($visit->support_description ? ': ' . $visit->support_description : ''))
            : null;

        return [
            'date'               => $visit->created_at->format('j M Y'),
            'by'                 => optional($visit->createdBy)->name,
            'status'             => $visit->status,
            'what_happened'      => $visit->problem_description,
            'support_needed'     => $support,
            'remarks'            => $visit->personal_remarks,
            'next_followup_date' => $visit->next_followup_date ? Carbon::parse($visit->next_followup_date)->format('j M Y') : null,
            'next_followup_plan' => $visit->next_followup_plan,
        ];
    }

    private function order(Order $order): array
    {
        return [
            'order_no' => $order->order_no,
            'date'     => optional($order->order_date)->format('j M Y'),
            'status'   => $order->status,
            'total'    => round((float) $order->total_amount, 2),
            'lines'    => $order->lines->map(fn (OrderLine $line) => trim(
                self::quantity((float) $line->quantity) . ' ' . optional($line->product)->unit . ' ' . optional($line->product)->name
            ))->values()->all(),
            'remark'   => $order->remark,
        ];
    }

    /** Confirmed orders over the last 90 days, the figure briefs quote. */
    private function orderSummary(Leads $lead, Carbon $now): array
    {
        $recent = Order::confirmed()
            ->where('lead_id', $lead->id)
            ->where('order_date', '>=', $now->copy()->subDays(90)->toDateString());

        return [
            'confirmed_last_90_days' => (clone $recent)->count(),
            'value_last_90_days'     => round((float) (clone $recent)->sum('total_amount'), 2),
            'last_order_date'        => optional(Order::confirmed()->where('lead_id', $lead->id)->max('order_date'), fn ($date) => Carbon::parse($date)->format('j M Y')),
        ];
    }

    private function openTasks(Leads $lead, Carbon $now): array
    {
        $risk = TaskRisk::fromConfig();

        return Tasks::where('lead_id', $lead->id)
            ->whereIn('status', TaskRisk::OPEN_STATUSES)
            ->with('users.user:id,name')
            ->orderBy('due_date')
            ->get()
            ->map(function (Tasks $task) use ($risk, $now) {
                $assessed = $risk->assessTask($task, $now);

                return [
                    'reference'   => $task->task_reference,
                    'title'       => $task->title,
                    'status'      => Tasks::getTaskStatus($task->status),
                    'subscriber'  => optional(optional($task->users->firstWhere('role', 2))->user)->name,
                    'appointment' => $task->appointment_date ? Carbon::parse($task->appointment_date)->format('j M Y, g:i A') : null,
                    'due'         => optional($assessed['due_at'])->format('j M Y, g:i A'),
                    'risk'        => str_replace('_', ' ', $assessed['level']),
                ];
            })
            ->values()
            ->all();
    }

    private function suggestions(array $recommendation): array
    {
        if (($recommendation['status'] ?? null) !== 'ready') {
            return ['status' => 'not enough data yet', 'items' => []];
        }

        return [
            'status'                  => 'ready',
            'similar_outlets'         => $recommendation['similar_outlets'],
            'estimated_monthly_value' => $recommendation['estimated_monthly_value'],
            'items'                   => collect($recommendation['items'])->map(fn ($item) => [
                'product'                => $item['name'],
                'sku'                    => $item['sku'],
                'kind'                   => $item['status'] === 'gap' ? 'not ordered yet' : 'ordered less than similar outlets',
                'similar_outlets_buying' => $item['buyers'] . ' of ' . $item['neighbors_used'],
                'suggested_monthly'      => $item['recommended_qty'] . ' ' . $item['unit'],
                'currently_monthly'      => $item['current_qty'] . ' ' . $item['unit'],
                'extra_monthly_value'    => $item['est_monthly_value'],
            ])->values()->all(),
            'why'                     => $recommendation['explanation']['why'] ?? null,
        ];
    }

    /** Every active product; descriptions only for the ones this outlet buys or is offered. */
    private function catalogue(array $describe): array
    {
        return Product::active()
            ->orderBy('category')
            ->orderBy('name')
            ->get(['id', 'sku', 'name', 'category', 'unit', 'unit_price', 'description'])
            ->map(fn (Product $product) => array_filter([
                'product'     => $product->name,
                'sku'         => $product->sku,
                'category'    => $product->category,
                'unit'        => $product->unit,
                'price'       => round((float) $product->unit_price, 2),
                'description' => in_array($product->id, $describe) && $product->description
                    ? Str::limit(trim($product->description), self::DESCRIPTION_LIMIT)
                    : null,
            ], fn ($value) => $value !== null))
            ->values()
            ->all();
    }

    /** 8.000 -> "8", 2.50 -> "2.5". */
    public static function quantity(float $quantity): string
    {
        return rtrim(rtrim(number_format($quantity, 3, '.', ''), '0'), '.');
    }
}
