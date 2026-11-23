<?php

namespace App\Http\Controllers\API\V1;

use App\Console\Commands\CheckDrinkIdeas;
use App\Helpers\Helper;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Recipe;
use App\Models\RecipeIngredient;
use App\Models\RecommendationFeedback;
use App\Services\Menu\MenuScanService;
use App\Support\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Drinks: recipes made from catalogue products, Admin only (the products
 * permission). Who a drink suits is tagged here, on the drink.
 *
 * A drink that reps have answered on is deactivated rather than deleted, so
 * the feedback history keeps it.
 */
class RecipeController extends Controller
{
    /** The kinds of outlet that serve drinks, offered on the form (the full list is too long to scan). */
    public const OUTLET_TYPES = [2, 14, 5, 9, 3, 1, 7, 4, 13];

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $status  = in_array($request->get('active'), ['0', 'all'], true) ? $request->get('active') : '1';
        $menus   = app(MenuScanService::class);
        $onMenus = $menus->onMenuCounts();

        $recipes = Recipe::with('ingredients.product')
            ->when($status !== 'all', fn ($query) => $query->where('is_active', $status === '1'))
            ->when($request->filled('search'), fn ($query) => $query->where('name', 'like', '%' . $request->search . '%'))
            ->when($request->filled('group'), fn ($query) => $query->whereJsonContains('customer_groups', (string) $request->group))
            ->orderBy('name')
            ->get()
            ->map(fn (Recipe $recipe) => $this->present($recipe) + ['on_menus' => $onMenus[$recipe->id] ?? 0])
            ->values();

        return Inertia::render('Recipes/Index', [
            'recipes' => $recipes,
            'stats'   => [
                'total'  => Recipe::count(),
                'active' => Recipe::active()->count(),
                'menus'  => $menus->menuCount(),
            ],
            // Menu rows no drink matched, and the drinks one could be another name for.
            'unrecognised' => $menus->unrecognisedRows(),
            'drinkOptions' => $menus->drinkOptions(),
            // The newest "ideas:check" result, or null before the first one.
            'ideasCheck'   => CheckDrinkIdeas::lastResult(),
            'filters' => ['active' => $status] + $request->only(['search', 'group']),
            'options' => $this->options(),
        ]);
    }

    /** One drink: its recipe, who it suits, and what reps answered. */
    public function view($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $recipe = Recipe::with('ingredients.product')->findOrFail($id);


        $latest = collect(RecommendationFeedback::latestDrinksByLead())
            ->map(fn (array $drinks) => $drinks[$recipe->id] ?? null)
            ->filter();

        $reasons = [];
        foreach ($latest as $row) {
            if ($row->status === 'declined' && $row->reason) {
                $reasons[$row->reason] = ($reasons[$row->reason] ?? 0) + 1;
            }
        }
        arsort($reasons);

        return Inertia::render('Recipes/Show', [
            'recipe'   => $this->present($recipe),
            'feedback' => [
                'pitched'  => $latest->where('status', 'pitched')->count(),
                'accepted' => $latest->where('status', 'accepted')->count(),
                'declined' => $latest->where('status', 'declined')->count(),
                'reasons'  => collect($reasons)->map(fn ($count, $reason) => [
                    'reason' => RecommendationFeedback::REASONS[$reason] ?? $reason,
                    'count'  => $count,
                ])->values(),
            ],
            'options'  => $this->options(),
        ]);
    }

    public function create()
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        return $this->form(new Recipe(['serve' => 'iced', 'is_active' => true]));
    }

    public function store(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $recipe = $this->save(new Recipe(['created_by' => Auth::guard('web')->id()]), $this->validated($request));

        alert()->success(trans('translation.success'), $recipe->name . ' added.')->showConfirmButton()->focusConfirm(true);

        return $request->boolean('add_another')
            ? redirect()->route('recipe.create')
            : redirect()->route('recipe.view', $recipe->id);
    }

    public function edit($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        return $this->form(Recipe::with('ingredients.product')->findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $recipe = $this->save(Recipe::findOrFail($id), $this->validated($request, (int) $id));

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->showConfirmButton()->focusConfirm(true);

        return redirect()->route('recipe.view', $recipe->id);
    }

    /** Adds a menu line as another name for a drink, so later scans recognise it. */
    public function alias(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $data   = $request->validate(['alias' => 'required|string|max:60']);
        $recipe = Recipe::findOrFail($id);
        $alias  = trim($data['alias']);

        $names = array_map('mb_strtolower', $recipe->names());
        if (!in_array(mb_strtolower($alias), $names, true)) {
            $recipe->update(['aliases' => array_values(array_merge($recipe->aliases ?? [], [$alias]))]);
        }

        alert()->success(trans('translation.success'), "\"{$alias}\" is now another name for {$recipe->name}. New scans will recognise it.")->showConfirmButton()->focusConfirm(true);

        return redirect()->back();
    }

    /** Runs "ideas:check" again for the "How the drink ideas behave" panel. */
    public function checkIdeas()
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        Artisan::call('ideas:check');

        return redirect()->back();
    }

    /** Makes an inactive drink available again. */
    public function activate($id)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $recipe = Recipe::findOrFail($id);
        $recipe->update(['is_active' => true]);

        alert()->success(trans('translation.success'), $recipe->name . ' is active again.')->showConfirmButton()->focusConfirm(true);

        return redirect()->back();
    }

    /** Deletes a drink nobody has answered on; otherwise only deactivates it. */
    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $recipe = Recipe::findOrFail($request->id);

        if (RecommendationFeedback::where('recipe_id', $recipe->id)->exists()) {
            $recipe->update(['is_active' => false]);
            $message = $recipe->name . ' has rep feedback, so it was deactivated instead of deleted.';
        } else {
            $recipe->delete();
            $message = $recipe->name . ' deleted.';
        }

        alert()->success(trans('translation.success'), $message)->showConfirmButton()->focusConfirm(true);

        return redirect()->route('recipe.index');
    }

    private function form(Recipe $recipe)
    {
        $products = Product::active()->orderBy('category')->orderBy('name')->get(['id', 'name', 'category', 'unit', 'unit_price', 'is_halal']);

        return Inertia::render('Recipes/Form', [
            'recipe'   => $this->present($recipe),
            'products' => $products->map(fn (Product $product) => [
                'value'      => $product->id,
                'label'      => $product->name,
                'category'   => $product->category,
                'unit'       => $product->unit,
                'unit_price' => (float) $product->unit_price,
                'is_halal'   => $product->is_halal,
            ])->values(),
            'options'  => $this->options(),
        ]);
    }

    /** Saves the drink and its ingredients together. */
    private function save(Recipe $recipe, array $data): Recipe
    {
        DB::transaction(function () use ($recipe, $data) {
            $recipe->fill(collect($data)->except('ingredients')->all());
            $recipe->slug = $this->slug($data['name'], $recipe->id);
            $recipe->save();

            $recipe->ingredients()->delete();
            foreach (array_values($data['ingredients']) as $sort => $ingredient) {
                RecipeIngredient::create([
                    'recipe_id'    => $recipe->id,
                    'product_id'   => (int) $ingredient['product_id'],
                    'quantity'     => (float) $ingredient['quantity'],
                    'amount_label' => isset($ingredient['amount_label']) && trim($ingredient['amount_label']) !== '' ? trim($ingredient['amount_label']) : null,
                    'sort'         => $sort,
                ]);
            }
        });

        return $recipe;
    }

    private function validated(Request $request, ?int $id = null): array
    {
        $data = $request->validate([
            'name'                       => ['required', 'string', 'max:120', Rule::unique('recipes', 'name')->ignore($id)],
            'description'                => 'nullable|string|max:1000',
            'category'                   => ['nullable', Rule::in(array_keys(Recipe::CATEGORIES))],
            'aliases'                    => 'nullable|array|max:12',
            'aliases.*'                  => 'string|max:60',
            'serve'                      => ['required', Rule::in(array_keys(Recipe::SERVES))],
            'outlet_types'               => 'nullable|array',
            'outlet_types.*'             => ['integer', Rule::in(array_keys(Helper::getBusinessCategoryListing()))],
            'customer_groups'            => 'nullable|array',
            'customer_groups.*'          => ['string', Rule::in(array_keys(Recipe::customerGroups()))],
            'price_tier'                 => ['nullable', Rule::in(array_keys(Recipe::PRICE_TIERS))],
            'is_active'                  => 'boolean',
            'everyday'                   => 'boolean',
            'ingredients'                => 'required|array|min:1|max:12',
            'ingredients.*.product_id'   => ['required', 'integer', 'distinct', Rule::exists('products', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'ingredients.*.quantity'     => 'required|numeric|gt:0|lt:100',
            'ingredients.*.amount_label' => 'nullable|string|max:40',
        ], [
            'ingredients.required'               => 'Add at least one product.',
            'ingredients.min'                    => 'Add at least one product.',
            'ingredients.*.product_id.required'  => 'Choose a product.',
            'ingredients.*.product_id.distinct'  => 'This product is already in the drink.',
            'ingredients.*.product_id.exists'    => 'Choose an active product. Inactive products can\'t go in a drink.',
            'ingredients.*.quantity.required'    => 'Enter how much one serve uses.',
            'ingredients.*.quantity.gt'          => 'Enter how much one serve uses.',
            'ingredients.*.quantity.lt'          => 'One serve should use less than 100 units.',
        ], [
            'name' => 'drink name',
        ]);

        $data['name']            = trim($data['name']);
        $data['is_active']       = $request->boolean('is_active');
        $data['everyday']        = $request->boolean('everyday');
        // An empty list means "any", the same as no list.
        $data['outlet_types']    = !empty($data['outlet_types']) ? array_map('intval', $data['outlet_types']) : null;
        $data['customer_groups'] = !empty($data['customer_groups']) ? array_values($data['customer_groups']) : null;

        // Other names: trimmed, no blanks, no repeats, and not the drink's own name again.
        $aliases = collect($data['aliases'] ?? [])
            ->map(fn ($alias) => trim((string) $alias))
            ->filter(fn (string $alias) => $alias !== '' && mb_strtolower($alias) !== mb_strtolower($data['name']))
            ->unique(fn (string $alias) => mb_strtolower($alias))
            ->values()
            ->all();
        $data['aliases'] = $aliases ?: null;

        return $data;
    }

    private function slug(string $name, ?int $id): string
    {
        $base = Str::slug($name) ?: 'drink';
        $slug = $base;
        $n    = 2;
        while (Recipe::where('slug', $slug)->when($id, fn ($query) => $query->whereKeyNot($id))->exists()) {
            $slug = $base . '-' . $n++;
        }

        return $slug;
    }

    private function present(Recipe $recipe): array
    {
        $ingredients = $recipe->exists ? $recipe->ingredients : collect();

        return [
            'id'              => $recipe->id,
            'name'            => $recipe->name,
            'slug'            => $recipe->slug,
            'aliases'         => $recipe->aliases ?? [],
            'category'        => $recipe->category,
            'description'     => $recipe->description,
            'serve'           => $recipe->serve,
            'outlet_types'    => $recipe->outlet_types ?? [],
            'customer_groups' => $recipe->customer_groups ?? [],
            'price_tier'      => $recipe->price_tier,
            'is_active'       => (bool) $recipe->is_active,
            'everyday'        => (bool) $recipe->everyday,
            'is_halal'        => $recipe->exists ? $recipe->isHalal() : true,
            'cost_per_serve'  => $recipe->exists ? $recipe->costPerServe() : 0.0,
            'ingredients'     => $ingredients->map(fn (RecipeIngredient $ingredient) => [
                'product_id'   => $ingredient->product_id,
                'name'         => optional($ingredient->product)->name,
                'unit'         => optional($ingredient->product)->unit,
                'unit_price'   => (float) optional($ingredient->product)->unit_price,
                'is_halal'     => optional($ingredient->product)->is_halal,
                'is_active'    => (bool) optional($ingredient->product)->is_active,
                'quantity'     => (float) $ingredient->quantity,
                'amount_label' => $ingredient->amount_label,
            ])->values()->all(),
        ];
    }

    private function options(): array
    {
        $types = Helper::getBusinessCategoryListing();

        return [
            'serves'         => Options::fromMap(Recipe::SERVES),
            'categories'     => Options::fromMap(Recipe::CATEGORIES),
            'customerGroups' => Options::fromMap(Recipe::customerGroups()),
            'outletTypes'    => array_map(fn (int $id) => ['value' => $id, 'label' => $types[$id]], self::OUTLET_TYPES),
            'priceTiers'     => Options::fromMap(Recipe::PRICE_TIERS),
            'typeLabels'     => $types,
        ];
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
