<?php

namespace App\Services\Menu;

/**
 * Turns what a phone read from menu photos into rows: one row per line of the
 * menu, with its price pulled out.
 *
 * A phone returns fragments with positions. A menu often prints the name on
 * the left and the price in its own column, which arrive as two fragments, so
 * fragments at the same height on the same photo are joined into one row.
 * A typed menu has no positions: each line is its own row.
 */
final class MenuReader
{
    /** A price is at least this and at most that, in RM; anything else is a size, a year or a phone number. */
    private const MIN_PRICE = 1.0;
    private const MAX_PRICE = 200.0;

    /**
     * Letters a phone reads in place of digits in some menu fonts. B for 3
     * comes from the first trial ("13.00" read as "1B.00"); the rest are the
     * usual look-alikes.
     */
    private const DIGIT_LOOKALIKES = ['O' => '0', 'o' => '0', 'D' => '0', 'B' => '3', 'l' => '1', 'I' => '1', 'S' => '5'];

    /**
     * @param array<int, array{text: string, page?: int, x?: float|int|null, y?: float|int|null, width?: float|int|null, height?: float|int|null}> $fragments
     * @return array<int, array{text: string, name: string, price: ?float, page: int}> in reading order
     */
    public function rows(array $fragments): array
    {
        $rows = [];

        foreach ($this->joinRows($fragments) as $row) {
            $text = trim(preg_replace('/\s+/u', ' ', $row['text']));
            if ($text === '') {
                continue;
            }

            [$name, $price] = $this->splitPrice($text);

            $rows[] = ['text' => $text, 'name' => $name, 'price' => $price, 'page' => $row['page']];
        }

        return $rows;
    }

    /** Rows from typed or pasted text, one per line. */
    public function rowsFromText(string $text): array
    {
        $lines = preg_split('/\r\n|\r|\n/', $text) ?: [];

        return $this->rows(array_map(fn (string $line) => ['text' => $line], $lines));
    }

    /**
     * The middle price of a list, or null when there are none.
     *
     * @param array<int, ?float> $prices
     */
    public static function medianPrice(array $prices): ?float
    {
        $prices = array_values(array_filter($prices, fn ($price) => $price !== null));
        if ($prices === []) {
            return null;
        }

        sort($prices);
        $count  = count($prices);
        $middle = intdiv($count, 2);

        return round($count % 2 ? $prices[$middle] : ($prices[$middle - 1] + $prices[$middle]) / 2, 2);
    }

    /**
     * Fragments on the same photo whose middles are within about half a line
     * of each other are one row, read left to right.
     *
     * @return array<int, array{text: string, page: int}>
     */
    private function joinRows(array $fragments): array
    {
        $placed = [];
        $loose  = [];

        foreach (array_values($fragments) as $index => $fragment) {
            $text = trim((string) ($fragment['text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $page = (int) ($fragment['page'] ?? 0);
            if (!is_numeric($fragment['y'] ?? null) || !is_numeric($fragment['height'] ?? null) || (float) $fragment['height'] <= 0) {
                $loose[] = ['text' => $text, 'page' => $page, 'order' => $index];
                continue;
            }

            $placed[] = [
                'text'   => $text,
                'page'   => $page,
                'x'      => (float) ($fragment['x'] ?? 0),
                'middle' => (float) $fragment['y'] + (float) $fragment['height'] / 2,
                'height' => (float) $fragment['height'],
                'group'  => isset($fragment['group']) ? (string) $fragment['group'] : null,
            ];
        }

        usort($placed, fn ($a, $b) => [$a['page'], $a['middle'], $a['x']] <=> [$b['page'], $b['middle'], $b['x']]);

        $rows = [];
        foreach ($placed as $fragment) {
            $target = self::rowFor($rows, $fragment);
            if ($target !== null) {
                $rows[$target]['parts'][] = $fragment;
                continue;
            }

            $rows[] = ['page' => $fragment['page'], 'middle' => $fragment['middle'], 'height' => $fragment['height'], 'group' => $fragment['group'], 'parts' => [$fragment]];
        }

        $joined = [];
        foreach ($rows as $row) {
            usort($row['parts'], fn ($a, $b) => $a['x'] <=> $b['x']);
            $joined[] = ['text' => implode(' ', array_column($row['parts'], 'text')), 'page' => $row['page']];
        }

        // Typed lines keep the order they were typed in, after any photographed ones.
        usort($loose, fn ($a, $b) => [$a['page'], $a['order']] <=> [$b['page'], $b['order']]);
        foreach ($loose as $line) {
            $joined[] = ['text' => $line['text'], 'page' => $line['page']];
        }

        return $joined;
    }

    /**
     * Splits "Iced Latte RM 12.90" into the name and the price. A row with
     * two prices (hot and iced, or two sizes) keeps the lower one.
     *
     * @return array{0: string, 1: ?float} the text without prices, and the price
     */
    private function splitPrice(string $text): array
    {
        $prices = [];
        $text   = self::fixMisreadPrices($text);

        // "RM 12", "RM12.90", "MYR 9".
        $name = preg_replace_callback('/\b(?:rm|myr)\s*(\d{1,3}(?:[.,]\d{1,2})?)(?!\d)/iu', function ($match) use (&$prices) {
            $prices[] = (float) str_replace(',', '.', $match[1]);

            return ' ';
        }, $text);

        // "12.90", "12.9", "12,90": a number written with cents.
        $name = preg_replace_callback('/(?<![\w.,])(\d{1,3}[.,]\d{1,2})(?![\w.,])/u', function ($match) use (&$prices) {
            $prices[] = (float) str_replace(',', '.', $match[1]);

            return ' ';
        }, $name);

        // "Latte 12" or "Latte 9 / 11": whole numbers only count at the end of the row.
        if (preg_match('/^(.*?\D)\s*((?:\d{1,3}\s*[\/|]\s*)*\d{1,3})\s*$/u', $name, $match) && trim($match[1]) !== '') {
            foreach (preg_split('/\s*[\/|]\s*/', trim($match[2])) as $number) {
                $prices[] = (float) $number;
            }
            $name = $match[1];
        }

        $prices = array_filter($prices, fn (float $price) => $price >= self::MIN_PRICE && $price <= self::MAX_PRICE);
        $name   = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\s.\-_:·•…|\/]+$/u', '', $name)));

        return [$name, $prices ? round(min($prices), 2) : null];
    }

    /**
     * The row a fragment joins, or null to start a new one. Rows at its height
     * on its photo are the candidates. When the reader knows the layout
     * (Textract), lines in different blocks are different columns of the menu:
     * a line joins the row of its own block, and a line that is only a price
     * joins the nearest row to its left, since prices often sit in a column
     * of their own beside the names.
     *
     * @return int|null the row's index
     */
    private static function rowFor(array $rows, array $fragment): ?int
    {
        $near = [];
        for ($i = count($rows) - 1; $i >= 0; $i--) {
            $row = $rows[$i];
            if ($row['page'] !== $fragment['page'] || $fragment['middle'] - $row['middle'] > 0.6 * max($row['height'], $fragment['height'])) {
                break;
            }
            if (abs($row['middle'] - $fragment['middle']) <= 0.6 * min($row['height'], $fragment['height'])) {
                $near[] = $i;
            }
        }
        if ($near === []) {
            return null;
        }

        // No layout known: the latest row at this height, as a phone's lines are joined.
        if ($fragment['group'] === null) {
            return $near[0];
        }
        foreach ($near as $i) {
            if ($rows[$i]['group'] === null || $rows[$i]['group'] === $fragment['group']) {
                return $i;
            }
        }

        if (preg_match('/^(?:rm|myr)?\s*\d{1,3}(?:[.,]\d{1,2})?$/iu', trim($fragment['text'])) !== 1) {
            return null;
        }

        $best = null;
        $bestX = null;
        foreach ($near as $i) {
            $right = max(array_column($rows[$i]['parts'], 'x'));
            if ($right < $fragment['x'] && ($bestX === null || $right > $bestX)) {
                [$best, $bestX] = [$i, $right];
            }
        }

        return $best;
    }

    /**
     * "1B.00" is 13.00 and "RM 1O" is RM 10: look-alike letters become digits,
     * but only in something shaped like a price (a number with cents, or one
     * after RM) that already has a real digit, so words are never touched.
     */
    private static function fixMisreadPrices(string $text): string
    {
        $look  = preg_quote(implode('', array_keys(self::DIGIT_LOOKALIKES)), '/');
        $fix   = fn (string $token) => preg_match('/\d/', $token) ? strtr($token, self::DIGIT_LOOKALIKES) : $token;
        // In the cents, l and I stay letters: "1.5l" is a bottle size, not RM 1.51.
        $cents = fn (string $token) => strtr($token, array_diff_key(self::DIGIT_LOOKALIKES, ['l' => 1, 'I' => 1, 'S' => 1]));

        // With cents: "1B.00", "l2.50", "9.5O".
        $text = preg_replace_callback(
            "/(?<![\\p{L}\\d])([\\d{$look}]{1,3})([.,])([\\d{$look}]{1,2})(?![\\p{L}\\d])/u",
            fn ($m) => preg_match('/\d/', $m[1] . $m[3]) ? $fix($m[1]) . $m[2] . $cents($m[3]) : $m[0],
            $text
        );

        // After RM: "RM 1B", "RM1O".
        return preg_replace_callback("/\\b(rm|myr)(\\s*)([\\d{$look}]{1,3})(?![\\p{L}\\d])/iu", fn ($m) => $m[1] . $m[2] . $fix($m[3]), $text);
    }
}
