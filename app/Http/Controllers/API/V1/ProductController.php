<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Catalogue\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Product catalogue, Admin only. Products are deactivated rather than
 * deleted once they appear on an order, so order history keeps its lines.
 */
class ProductController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $products = Product::query()
            ->when($request->filled('search'), fn ($q) => $q->where(fn ($inner) => $inner
                ->where('name', 'like', '%' . $request->search . '%')
                ->orWhere('sku', 'like', '%' . $request->search . '%')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->category))
            ->when($request->get('active', '1') !== 'all', fn ($q) => $q->where('is_active', $request->get('active', '1') === '1'))
            ->withCount('orderLines')
            ->orderBy('category')
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        $categories  = Product::categories();
        $tmenu_part1 = 'Products';
        $tmenu_part2 = 'Catalogue';
        $tmenu_part3 = trans('translation.total') . ':' . $products->total();

        return Inertia::render('Products/Index', [
            'products'    => $products->through(fn (Product $product) => ProductResource::make($product)->resolve()),
            'categories'  => $categories,
            'filters'     => $request->only(['search', 'category', 'active']),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }

    public function create()
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product     = new Product(['unit' => 'unit', 'is_active' => true]);
        $categories  = Product::categories();
        $tmenu_part1 = 'Products';
        $tmenu_part2 = 'Catalogue';
        $tmenu_part3 = trans('translation.create');

        return $this->form($product, $categories, compact('tmenu_part1', 'tmenu_part2', 'tmenu_part3'));
    }

    public function store(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        Product::create($this->validated($request));

        alert()->success(trans('translation.success'), trans('translation.successfully_create'))->showConfirmButton()->focusConfirm(true);

        return redirect()->route('product.index');
    }

    public function edit($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product     = Product::findOrFail($id);
        $categories  = Product::categories();
        $tmenu_part1 = 'Products';
        $tmenu_part2 = 'Catalogue';
        $tmenu_part3 = trans('translation.edit') . ' (' . $product->sku . ')';

        return $this->form($product, $categories, compact('tmenu_part1', 'tmenu_part2', 'tmenu_part3'));
    }

    public function update(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $product = Product::findOrFail($id);
        $product->update($this->validated($request, $product));

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->showConfirmButton()->focusConfirm(true);

        return redirect()->route('product.index');
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
            $message = $product->sku . ' is on existing orders, so it was deactivated instead of deleted.';
        } else {
            $product->delete();
            $message = $product->sku . ' deleted.';
        }

        alert()->success(trans('translation.success'), $message)->showConfirmButton()->focusConfirm(true);

        return redirect()->route('product.index');
    }

    /** The create / edit page; a product that does not exist yet is new. */
    private function form(Product $product, array $categories, array $breadcrumb)
    {
        return Inertia::render('Products/Form', [
            'product'    => ProductResource::make($product)->resolve(),
            'categories' => $categories,
        ] + $breadcrumb);
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
        $data['is_active'] = $request->boolean('is_active');

        return $data;
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
