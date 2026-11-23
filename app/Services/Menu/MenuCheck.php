<?php

namespace App\Services\Menu;

use App\Models\Recipe;

/**
 * How accurately menus are read and matched: for each menu, the drinks a
 * scan finds against the list of drinks a person says are on it.
 *
 *   right    found, and on the list
 *   missed   on the list, not found
 *   wrong    found, not on the list
 *
 * Precision is right out of everything found; recall is right out of
 * everything on the lists. Both are over all the menus together.
 */
final class MenuCheck
{
    public function __construct(private MenuScanService $scans)
    {
    }

    /**
     * What the phone's "Copy the text" gives, or a typed menu, as fragments.
     * The copy has a "Photo 1 (…)" line per photo, then "x,y,width,height | text"
     * per line; any other line is a typed line.
     */
    public static function fragmentsFromCopy(string $text): array
    {
        $fragments = [];
        $page      = 0;

        foreach (preg_split('/\r\n|\r|\n/', $text) ?: [] as $line) {
            if (preg_match('/^\s*Photo\s+(\d+)\b/i', $line, $match)) {
                $page = max(0, (int) $match[1] - 1);
                continue;
            }
            if (preg_match('/^\s*(-?\d+),(-?\d+),(\d+),(\d+)\s*\|\s?(.*)$/', $line, $match)) {
                $fragments[] = ['text' => $match[5], 'page' => $page, 'x' => (int) $match[1], 'y' => (int) $match[2], 'width' => (int) $match[3], 'height' => (int) $match[4]];
                continue;
            }
            if (trim($line) !== '') {
                $fragments[] = ['text' => $line, 'page' => $page];
            }
        }

        return $fragments;
    }

    /**
     * @param array<int, array{name: string, fragments: array, answer: string[]}> $menus
     * @return array{menus: array, right: int, missed: int, wrong: int, precision: ?float, recall: ?float, unknown_answers: string[]}
     */
    public function run(array $menus): array
    {
        $byName = $this->drinksByName();
        $names  = Recipe::pluck('name', 'id')->all();
        $totals = ['right' => 0, 'missed' => 0, 'wrong' => 0];
        $rows   = [];
        $unknown = [];

        foreach ($menus as $menu) {
            $expected = [];
            foreach ($menu['answer'] as $answer) {
                $id = $byName[mb_strtolower(trim($answer))] ?? null;
                if ($id === null) {
                    $unknown[] = trim($answer);
                    continue;
                }
                $expected[$id] = true;
            }

            $items = $this->scans->findDrinks($menu['fragments']);
            $found = [];
            foreach ($items as $item) {
                if ($item['kind'] === 'matched') {
                    $found[$item['recipe_id']] = true;
                }
            }

            $right  = array_keys(array_intersect_key($found, $expected));
            $missed = array_keys(array_diff_key($expected, $found));
            $wrong  = array_keys(array_diff_key($found, $expected));

            $totals['right']  += count($right);
            $totals['missed'] += count($missed);
            $totals['wrong']  += count($wrong);

            $label  = fn (array $ids) => array_map(fn (int $id) => $names[$id] ?? "#{$id}", $ids);
            $rows[] = [
                'name'         => $menu['name'],
                'right'        => $label($right),
                'missed'       => $label($missed),
                'wrong'        => $label($wrong),
                'unrecognised' => array_values(array_map(fn ($item) => $item['text'], array_filter($items, fn ($item) => $item['kind'] === 'unrecognised'))),
            ];
        }

        $foundAll = $totals['right'] + $totals['wrong'];
        $listed   = $totals['right'] + $totals['missed'];

        return ['menus' => $rows] + $totals + [
            'precision'       => $foundAll ? round($totals['right'] / $foundAll, 3) : null,
            'recall'          => $listed ? round($totals['right'] / $listed, 3) : null,
            'unknown_answers' => array_values(array_unique($unknown)),
        ];
    }

    /** @return array<string, int> any name or other name, in lower case => drink id */
    private function drinksByName(): array
    {
        $map = [];
        foreach (Recipe::all(['id', 'name', 'aliases']) as $recipe) {
            foreach ($recipe->names() as $name) {
                $map[mb_strtolower($name)] ??= $recipe->id;
            }
        }

        return $map;
    }
}
