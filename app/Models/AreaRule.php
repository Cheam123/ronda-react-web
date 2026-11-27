<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * For one area type (university, office, ...), the kinds of drink and the
 * price levels that suit it. The menu ranking reads them for the Area part
 * of an idea's score. Empty lists mean any.
 */
class AreaRule extends Model
{
    protected $fillable = [
        'kind',
        'categories',
        'price_tiers',
        'note',
    ];

    protected $casts = [
        'categories'  => 'array',
        'price_tiers' => 'array',
    ];

    /** @return array<string, string> area type => its name, in page order */
    public static function kinds(): array
    {
        return config('ife.recommendation.area.area_labels', []);
    }

    /**
     * Every area type's rule as MenuIdeas reads it. A type with no saved rule
     * has empty lists, so only its customer group counts.
     *
     * @return array<string, array{categories: string[], tiers: string[]}>
     */
    public static function forRanking(): array
    {
        $saved = static::query()->get()->keyBy('kind');

        $rules = [];
        foreach (array_keys(static::kinds()) as $kind) {
            $rule         = $saved->get($kind);
            $rules[$kind] = [
                'categories' => array_values($rule?->categories ?? []),
                'tiers'      => array_values($rule?->price_tiers ?? []),
            ];
        }

        return $rules;
    }

    /** @return array<string, string> area type => what the area is like, for the outlet's area card */
    public static function notes(): array
    {
        return once(fn () => array_filter(static::query()->pluck('note', 'kind')->all()));
    }

    /**
     * The starting rules in database/data/area_rules.json.
     *
     * @return array<string, array{categories: string[], price_tiers: string[], note: ?string}>
     */
    public static function defaults(?string $path = null): array
    {
        $file = $path ?? database_path('data/area_rules.json');

        return json_decode((string) file_get_contents($file), true)['rules'] ?? [];
    }
}
