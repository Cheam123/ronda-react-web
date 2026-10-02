<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Catalogue\ProductResource;
use App\Models\Leads;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OutletRecommendation;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Product catalogue, Admin only. Products are deactivated rather than
 * deleted once they appear on an order, so order history keeps its lines.
 *
 * "Last 30 days" is today and the 29 days before it, counting confirmed
 * orders only.
 */
class ProductController extends Controller
{
    /** Units offered on the form even before any product uses them. */
    private const DEFAULT_UNITS = ['kg', 'litre', 'bottle', 'box', 'pack', 'tub', 'unit'];

    private const SORTS = ['category', 'sold', 'price', 'recent'];

    /** The category filter value for products without a category. */
    private const NO_CATEGORY = '__none';

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $since  = Carbon::now()->subDays(29)->toDateString();
        $status = in_array($request->get('active'), ['0', 'all'], true) ? $request->get('active') : '1';
        $sort   = in_array($request->get('sort'), self::SORTS, true) ? $request->get('sort') : 'category';
        $byStatus = fn ($query) => $query->when($status !== 'all', fn ($q) => $q->where('is_active', $status === '1'));

        $query = Product::query()
            ->select('products.*')
            ->withCount('orderLines')
            ->addSelect([
                'sold_qty'   => $this->confirmedLines($since)->selectRaw('COALESCE(SUM(order_lines.quantity), 0)'),
                'sold_value' => $this->confirmedLines($since)->selectRaw('COALESCE(SUM(order_lines.line_total), 0)'),
                'outlets'    => $this->confirmedLines($since)->selectRaw('COUNT(DISTINCT orders.lead_id)'),
            ])
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($inner) => $inner
                ->where('name', 'like', '%' . $request->search . '%')
                ->orWhere('sku', 'like', '%' . $request->search . '%')))
            ->when($request->filled('category'), fn ($q) => $request->category === self::NO_CATEGORY
                ? $q->whereNull('category')
                : $q->where('category', $request->category))
            ->when($request->boolean('stale'), fn ($q) => $q->stale());
        $byStatus($query);
        $this->sortBy($query, $sort);
        $products = $query->paginate(50)->withQueryString();

        $staleIds    = Product::stale()->pluck('id')->flip();
        $recommended = $this->recommendationCounts();

        $categoryCounts = $byStatus(Product::query())
            ->selectRaw('category, COUNT(*) AS total')
            ->groupBy('category')
            ->orderBy('category')
            ->get()
            ->map(fn ($row) => ['name' => $row->category, 'count' => (int) $row->total])
            ->values();

        return Inertia::render('Products/Index', [
            'products'   => $products->through(fn (Product $product) => ProductResource::make($product)->resolve() + [
                'sold_qty'          => round((float) $product->sold_qty, 2),
                'sold_value'        => round((float) $product->sold_value, 2),
                'outlets'           => (int) $product->outlets,
                'stale'             => $staleIds->has($product->id),
                'recommended_count' => $recommended[$product->id] ?? 0,
            ]),
            'categories' => $categoryCounts,
            'stats'      => [
                'total'    => Product::count(),
                'active'   => Product::active()->count(),
                'inactive' => Product::where('is_active', false)->count(),
                'sold_30d' => round((float) $this->confirmedLines($since, false)->sum('order_lines.line_total'), 2),
                'stale'    => $staleIds->count(),
            ],
            'filters'    => ['active' => $status, 'sort' => $sort] + $request->only(['search', 'category', 'stale']),
        ]);
    }

    /** One product: how it sells, who orders it, and where it is recommended. */
    public function view($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::withCount('orderLines')->findOrFail($id);
        $now     = Carbon::now();

        $window = fn (Carbon $from, Carbon $to) => $this->confirmedLines($from->toDateString(), false)
            ->where('order_lines.product_id', $product->id)
            ->where('orders.order_date', '<=', $to->toDateString());

        $current = $window($now->copy()->subDays(29), $now)
            ->selectRaw('COALESCE(SUM(order_lines.quantity), 0) AS qty, COALESCE(SUM(order_lines.line_total), 0) AS value, COUNT(DISTINCT orders.lead_id) AS outlets')
            ->toBase()->first();
        $previousValue = (float) $window($now->copy()->subDays(59), $now->copy()->subDays(30))->sum('order_lines.line_total');

        $categoryValue = $product->category
            ? (float) $this->confirmedLines($now->copy()->subDays(29)->toDateString(), false)
                ->join('products', 'products.id', '=', 'order_lines.product_id')
                ->where('products.category', $product->category)
                ->sum('order_lines.line_total')
            : null;

        $recommended = $this->recommendedTo($product);

        return Inertia::render('Products/Show', [
            'product'     => ProductResource::make($product)->resolve() + [
                'created_label' => optional($product->created_at)->format('j M Y'),
                'updated_label' => optional($product->updated_at)->format('j M Y'),
            ],
            'stats'       => [
                'sold_qty'       => round((float) $current->qty, 2),
                'sold_value'     => round((float) $current->value, 2),
                'previous_value' => round($previousValue, 2),
                'change_pct'     => $previousValue > 0 ? round(((float) $current->value - $previousValue) / $previousValue * 100, 1) : null,
                'category_share' => $categoryValue ? round((float) $current->value / $categoryValue * 100) : null,
                'outlets'        => (int) $current->outlets,
                'customers'      => Leads::whereNotNull('customer_id')->where('customer_id', '!=', '')->count(),
                'stale'          => Product::stale()->whereKey($product->id)->exists(),
            ],
            'monthly'     => $this->monthlySales($product, $now),
            'lines'       => $this->recentLines($product),
            'recommended' => $recommended->take(5)->values(),
            'recommendedCount' => $recommended->count(),
        ]);
    }

    public function create()
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        return $this->form(new Product(['unit' => 'unit', 'is_active' => true]));
    }

    public function store(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::create($this->validated($request));

        alert()->success(trans('translation.success'), $product->name . ' added to the catalogue.')->showConfirmButton()->focusConfirm(true);

        return $request->boolean('add_another')
            ? redirect()->route('product.create')
            : redirect()->route('product.index');
    }

    public function edit($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        return $this->form(Product::withCount('orderLines')->findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::findOrFail($id);
        $product->update($this->validated($request, $product));

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->showConfirmButton()->focusConfirm(true);

        return redirect()->route('product.view', $product->id);
    }

    /** Deletes a product nobody has ordered; otherwise only deactivates it. */
    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::withCount('orderLines')->findOrFail($request->id);

        if ($product->order_lines_count > 0) {
            $product->update(['is_active' => false]);
            alert()->success(trans('translation.success'), $product->name . ' is on past orders, so it was deactivated instead of deleted.')->showConfirmButton()->focusConfirm(true);

            return redirect()->back();
        }

        $product->delete();
        alert()->success(trans('translation.success'), $product->name . ' deleted.')->showConfirmButton()->focusConfirm(true);

        return redirect()->route('product.index');
    }

    /** Offers an inactive product on orders and recommendations again. */
    public function activate($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::findOrFail($id);
        $product->update(['is_active' => true]);

        alert()->success(trans('translation.success'), $product->name . ' is active again.')->showConfirmButton()->focusConfirm(true);

        return redirect()->back();
    }

    /** The create / edit page; a product that does not exist yet is new. */
    private function form(Product $product)
    {
        $categories = Product::whereNotNull('category')
            ->selectRaw('category, COUNT(*) AS total, MIN(unit_price) AS min_price, MAX(unit_price) AS max_price')
            ->groupBy('category')
            ->orderBy('category')
            ->get()
            ->map(fn ($row) => [
                'name'      => $row->category,
                'count'     => (int) $row->total,
                'min_price' => (float) $row->min_price,
                'max_price' => (float) $row->max_price,
            ]);

        $units = collect(self::DEFAULT_UNITS)
            ->merge(Product::whereNotNull('unit')->distinct()->orderBy('unit')->pluck('unit'))
            ->map(fn ($unit) => trim($unit))
            ->filter()
            ->unique()
            ->values();

        return Inertia::render('Products/Form', [
            'product'    => ProductResource::make($product)->resolve(),
            'categories' => $categories,
            'units'      => $units,
        ]);
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        $data = $request->validate([
            'sku'         => ['required', 'string', 'max:50', Rule::unique('products', 'sku')->ignore(optional($product)->id)->whereNull('deleted_at')],
            'name'        => 'required|string|max:150',
            'category'    => 'nullable|string|max:50',
            'unit'        => 'required|string|max:20',
            'unit_price'  => 'required|numeric|min:0|max:9999999',
            'description' => 'nullable|string|max:2000',
        ]);

        $data['sku']       = strtoupper(trim($data['sku']));
        $data['category']  = isset($data['category']) && trim($data['category']) !== '' ? trim($data['category']) : null;
        $data['unit']      = trim($data['unit']);
        $data['is_active'] = $request->boolean('is_active');

        return $data;
    }

    /**
     * Order lines on confirmed orders since a date. Correlated to the outer
     * products row unless $correlated is false.
     */
    private function confirmedLines(string $since, bool $correlated = true)
    {
        return OrderLine::query()
            ->join('orders', 'orders.id', '=', 'order_lines.order_id')
            ->when($correlated, fn ($q) => $q->whereColumn('order_lines.product_id', 'products.id'))
            ->where('orders.status', Order::STATUS_CONFIRMED)
            ->whereNull('orders.deleted_at')
            ->where('orders.order_date', '>=', $since);
    }

    private function sortBy($query, string $sort): void
    {
        match ($sort) {
            'sold'   => $query->orderByDesc('sold_value')->orderBy('name'),
            'price'  => $query->orderByDesc('unit_price')->orderBy('name'),
            'recent' => $query->orderByDesc('created_at'),
            default  => $query->orderByRaw('category IS NULL')->orderBy('category')->orderBy('name'),
        };
    }

    /** product_id => how many outlets it is currently recommended to. */
    private function recommendationCounts(): array
    {
        $counts = [];
        foreach (OutletRecommendation::get(['items']) as $row) {
            foreach ((array) $row->items as $item) {
                if (isset($item['product_id'])) {
                    $counts[$item['product_id']] = ($counts[$item['product_id']] ?? 0) + 1;
                }
            }
        }

        return $counts;
    }

    /** Outlets whose current recommendations include this product, biggest opportunity first. */
    private function recommendedTo(Product $product)
    {
        return OutletRecommendation::with('lead:id,name,business_name,customer_id')->get()
            ->map(function (OutletRecommendation $row) use ($product) {
                $item = collect($row->items)->firstWhere('product_id', $product->id);
                if (!$item || !$row->lead) {
                    return null;
                }

                return [
                    'lead_id'        => $row->lead_id,
                    'outlet'         => $row->lead->business_name ?: $row->lead->name,
                    'prospect'       => blank($row->lead->customer_id),
                    'status'         => $item['status'] ?? 'gap',
                    'buyers'         => (int) ($item['buyers'] ?? 0),
                    'neighbors_used' => (int) ($item['neighbors_used'] ?? 0),
                    'quantity'       => (float) ($item['recommended_qty'] ?? 0),
                    'value'          => (float) ($item['est_monthly_value'] ?? 0),
                ];
            })
            ->filter()
            ->sortByDesc('value')
            ->values();
    }

    /** Confirmed sales per calendar month, this month and the five before. */
    private function monthlySales(Product $product, Carbon $now): array
    {
        $start = $now->copy()->startOfMonth()->subMonthsNoOverflow(5);
        $rows  = $this->confirmedLines($start->toDateString(), false)
            ->where('order_lines.product_id', $product->id)
            ->get(['orders.order_date', 'order_lines.quantity', 'order_lines.line_total'])
            ->groupBy(fn ($line) => Carbon::parse($line->order_date)->format('Y-m'));

        $months = [];
        for ($month = $start->copy(); $month->lte($now); $month->addMonthNoOverflow()) {
            $lines    = $rows[$month->format('Y-m')] ?? collect();
            $months[] = [
                'month'    => $month->format('Y-m'),
                'label'    => $month->format('M'),
                'quantity' => round((float) $lines->sum('quantity'), 2),
                'value'    => round((float) $lines->sum('line_total'), 2),
            ];
        }

        return $months;
    }

    /** The latest lines on confirmed orders. */
    private function recentLines(Product $product, int $limit = 8): array
    {
        return OrderLine::query()
            ->select('order_lines.*')
            ->join('orders', 'orders.id', '=', 'order_lines.order_id')
            ->where('order_lines.product_id', $product->id)
            ->where('orders.status', Order::STATUS_CONFIRMED)
            ->whereNull('orders.deleted_at')
            ->orderByDesc('orders.order_date')
            ->orderByDesc('orders.id')
            ->with(['order.lead:id,name,business_name', 'order.createdBy:id,name'])
            ->take($limit)
            ->get()
            ->map(fn (OrderLine $line) => [
                'id'          => $line->id,
                'order_no'    => $line->order->order_no,
                'lead_id'     => $line->order->lead_id,
                'outlet'      => $line->order->lead ? ($line->order->lead->business_name ?: $line->order->lead->name) : null,
                'recorded_by' => optional($line->order->createdBy)->name,
                'date_label'  => $line->order->order_date->format('j M Y'),
                'quantity'    => (float) $line->quantity,
                'line_total'  => (float) $line->line_total,
            ])
            ->all();
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
