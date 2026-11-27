<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\AreaRule;
use App\Models\Recipe;
use App\Support\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Area rules: for each area type around an outlet, the kinds of drink and
 * price levels that suit it. Admin only (the products permission), next to
 * Drinks. The menu ranking reads them for the Area part of an idea's score.
 */
class AreaRuleController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index()
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $saved      = AreaRule::all()->keyBy('kind');
        $groups     = Recipe::customerGroups();
        $config     = config('ife.recommendation.area', []);
        $placeNames = $config['place_labels'] ?? [];

        $rules = [];
        foreach (AreaRule::kinds() as $kind => $label) {
            $rule = $saved->get($kind);

            // The kinds of place that make up this area type, in words.
            $places = array_keys(array_filter($config['place_categories'] ?? [], fn (string $type) => $type === $kind));

            $rules[] = [
                'kind'        => $kind,
                'label'       => $label,
                'customers'   => $groups[$kind] ?? null,
                'places'      => array_map(fn (string $category) => $placeNames[$category] ?? ucfirst(str_replace('_', ' ', $category)), $places),
                'categories'  => array_values($rule?->categories ?? []),
                'price_tiers' => array_values($rule?->price_tiers ?? []),
                'note'        => $rule?->note ?? '',
            ];
        }

        return Inertia::render('Recipes/AreaRules', [
            'rules'   => $rules,
            'scoring' => [
                'radius'  => (int) ($config['live']['radius'] ?? 1000),
                'decay'   => (int) ($config['decay_metres'] ?? 500),
                'present' => (int) round(100 * (float) ($config['present_share'] ?? 0.25)),
                'some'    => (int) round(100 * (float) ($config['some_share'] ?? 0.10)),
            ],
            'options' => [
                'categories' => Options::fromMap(Recipe::CATEGORIES),
                'priceTiers' => Options::fromMap(Recipe::PRICE_TIERS),
            ],
        ]);
    }

    public function update(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_product')) {
            return $this->accessError();
        }

        $data = $request->validate([
            'rules'                 => ['required', 'array'],
            'rules.*.kind'          => ['required', 'distinct', Rule::in(array_keys(AreaRule::kinds()))],
            'rules.*.categories'    => ['nullable', 'array'],
            'rules.*.categories.*'  => ['string', Rule::in(array_keys(Recipe::CATEGORIES))],
            'rules.*.price_tiers'   => ['nullable', 'array'],
            'rules.*.price_tiers.*' => ['string', Rule::in(array_keys(Recipe::PRICE_TIERS))],
            'rules.*.note'          => ['nullable', 'string', 'max:200'],
        ], [
            'rules.*.note.max' => 'Keep the note under 200 characters.',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['rules'] as $rule) {
                AreaRule::updateOrCreate(['kind' => $rule['kind']], [
                    'categories'  => array_values(array_unique($rule['categories'] ?? [])),
                    'price_tiers' => array_values(array_unique($rule['price_tiers'] ?? [])),
                    'note'        => trim((string) ($rule['note'] ?? '')) ?: null,
                ]);
            }
        });

        alert()->success(trans('translation.success'), 'Area rules saved. New menu scans use them.')->showConfirmButton()->focusConfirm(true);

        return redirect()->route('recipe.areaRules');
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
