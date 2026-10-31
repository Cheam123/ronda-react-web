<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\FormSubmission;
use App\Models\IFEReport;
use App\Models\Order;
use App\Services\FormRecordService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * The Me screen: what the caller did this month, how many records they have,
 * and the orders they recorded. Always the caller's own work.
 */
class MeController extends Controller
{
    public function __construct(private FormRecordService $records)
    {
    }

    public function stats(Request $request)
    {
        $user  = $request->user();
        $month = Carbon::now()->startOfMonth();

        $monthOrders = Order::confirmed()
            ->where('created_by', $user->id)
            ->where('order_date', '>=', $month->toDateString());

        return $this->response_ok([
            'month_label' => $month->format('F Y'),
            'month'       => [
                'visits'       => IFEReport::where('created_by', $user->id)->where('created_at', '>=', $month)->count(),
                'orders'       => (clone $monthOrders)->count(),
                'orders_value' => round((float) (clone $monthOrders)->sum('total_amount'), 2),
                'forms'        => FormSubmission::where('submitted_by', $user->id)->where('created_at', '>=', $month)->count(),
            ],
            // The counts beside the My records rows, all time.
            'totals'      => [
                'visits' => IFEReport::where('created_by', $user->id)->count(),
                'forms'  => $this->records->visibleFor($user)->count(),
                'orders' => Order::where('created_by', $user->id)->count(),
            ],
            'currency'    => config('ife.currency', 'RM'),
        ], 'Stats retrieved successfully.');
    }

    /**
     * Orders the caller recorded, newest first, in the same shape as an
     * outlet's order history plus the outlet. `mine=1` is the only scope for
     * now: a manager's view of the team's orders is on the web.
     */
    public function orders(Request $request)
    {
        $limit = max(1, min((int) $request->input('per_page', 50), 100));

        $orders = Order::where('created_by', $request->user()->id)
            ->with(['lines.product', 'createdBy:id,name', 'lead:id,name,business_name'])
            ->orderByDesc('order_date')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        return $this->response_ok([
            'currency' => config('ife.currency', 'RM'),
            'orders'   => $orders->map(fn (Order $order) => $order->toSummary() + [
                'lead_id' => $order->lead_id,
                'outlet'  => optional($order->lead)->business_name ?: optional($order->lead)->name,
            ])->values(),
        ], 'Orders retrieved successfully.');
    }
}
