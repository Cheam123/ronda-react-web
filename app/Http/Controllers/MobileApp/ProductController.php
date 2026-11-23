<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

/**
 * The active product catalogue, for order entry.
 * Read-only: the catalogue is maintained on the web by Admins.
 */
class ProductController extends Controller
{
    public function index(Request $request)
    {
        $search   = trim((string) $request->input('search', ''));
        $category = $request->input('category');

        $products = Product::active()
            ->when($search !== '', fn ($q) => $q->where(fn ($inner) => $inner
                ->where('name', 'like', "%{$search}%")
                ->orWhere('sku', 'like', "%{$search}%")))
            ->when($category, fn ($q) => $q->where('category', $category))
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        return $this->response_success([
            'currency'   => config('ife.currency', 'RM'),
            'categories' => Product::active()->whereNotNull('category')->distinct()->orderBy('category')->pluck('category')->values(),
            'products'   => $products->map(fn (Product $product) => [
                'id'          => $product->id,
                'sku'         => $product->sku,
                'name'        => $product->name,
                'category'    => $product->category,
                'unit'        => $product->unit,
                'unit_price'  => (float) $product->unit_price,
                'description' => $product->description,
            ])->values(),
        ], 'Products retrieved successfully.');
    }
}
