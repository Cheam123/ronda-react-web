<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Catalogue\ProductResource;
use App\Models\Leads;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Recording an outlet's orders from the web lead page. The mobile app has
 * the same through MobileApp\LeadController; both go through OrderService.
 */
class OrderController extends Controller
{
    public function __construct(private OrderService $orders)
    {
        $this->middleware('auth');
    }

    public function create($id)
    {
        $user = Auth::guard('web')->user();
        if (!$user->can('record_order')) {
            return $this->accessError();
        }

        $lead     = Leads::visibleTo($user)->findOrFail($id);
        $products = Product::active()->orderBy('category')->orderBy('name')->get();

        $tmenu_part1 = trans('translation.customer');
        $tmenu_part2 = $lead->business_name ?: $lead->name;
        $tmenu_part3 = 'Record Order';

        return Inertia::render('Orders/Create', [
            'lead'        => [
                'id'            => $lead->id,
                'name'          => $lead->name,
                'business_name' => $lead->business_name,
                'customer_id'   => $lead->customer_id,
            ],
            'products'    => ProductResource::collection($products)->resolve(),
            'today'       => now()->toDateString(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }

    public function store(Request $request, $id)
    {
        $user = Auth::guard('web')->user();
        if (!$user->can('record_order')) {
            return $this->accessError();
        }

        $lead = Leads::visibleTo($user)->findOrFail($id);

        $request->validate([
            'order_date' => 'nullable|date',
            'remark'     => 'nullable|string|max:1000',
            'lines'      => 'nullable|array',
        ]);

        // Blank rows from the form are not lines.
        $lines = collect($request->input('lines', []))
            ->filter(fn ($line) => !empty($line['product_id']) || !empty($line['quantity']))
            ->values()
            ->all();

        $order = $this->orders->record($lead, $user, $lines, $request->input('order_date'), $request->input('remark'));

        alert()->success(trans('translation.success'), 'Order ' . $order->order_no . ' recorded. Good work on that visit!')->showConfirmButton()->focusConfirm(true);

        return redirect()->route('lead.view', $lead->id);
    }

    public function cancel($orderId)
    {
        $user = Auth::guard('web')->user();
        if (!$user->can('manage_order')) {
            return $this->accessError();
        }

        $order = Order::findOrFail($orderId);
        Leads::visibleTo($user)->findOrFail($order->lead_id);

        $this->orders->cancel($order);

        alert()->success(trans('translation.success'), 'Order ' . $order->order_no . ' cancelled. It stays in the history.')->showConfirmButton()->focusConfirm(true);

        return redirect()->route('lead.view', $order->lead_id);
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
