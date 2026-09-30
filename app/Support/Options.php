<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Dropdown options for the React front end: [{value, label}, ...].
 *
 * A list, not a {value: label} object, so the order the backend defines
 * survives JSON (objects with numeric keys are re-sorted by the browser).
 */
class Options
{
    /**
     * From a [value => label] map, e.g. User::getUserTypeListing().
     */
    public static function fromMap(array $map): array
    {
        return collect($map)
            ->map(fn ($label, $value) => ['value' => $value, 'label' => (string) $label])
            ->values()
            ->all();
    }

    /**
     * From models or arrays, reading the value and label from two fields.
     */
    public static function fromCollection(iterable $items, string $valueField = 'id', string $labelField = 'name'): array
    {
        return Collection::make($items)
            ->map(fn ($item) => [
                'value' => data_get($item, $valueField),
                'label' => (string) data_get($item, $labelField),
            ])
            ->values()
            ->all();
    }
}
