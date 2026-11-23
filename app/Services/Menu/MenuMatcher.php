<?php

namespace App\Services\Menu;

/**
 * Works out which known drinks a menu row names.
 *
 * A drink is on a row when the row has every word of one of the drink's
 * names (its name, or another name a menu may use for it), in any order.
 * Words that don't identify a drink ("iced", "large") are dropped from both
 * sides first, and one wrong letter is allowed in a longer word (two in a
 * long one), because a phone misreads a letter now and then. A lower-case
 * line listing things with no price is a description and is left out.
 *
 * The longest name wins, so "Strawberry Matcha Latte" is that drink and not a
 * Matcha Latte. A row may name several drinks ("Latte / Cappuccino"): what
 * the first match used is set aside and the rest is matched again.
 */
final class MenuMatcher
{
    /** Words this long or longer may be one letter off. */
    private const FUZZY_FROM = 5;

    /** Words this long or longer may be two letters off ("Oappucoino" is still a Cappuccino). */
    private const FUZZY_TWO_FROM = 9;

    /** A row with no price must be mostly the drink's name to count (not a description that mentions it). */
    private const MIN_SHARE_WITHOUT_PRICE = 0.5;

    /** @var array<int, array{id: int, words: string[]}> one entry per name, longest first */
    private array $names = [];

    /** @var array<string, true> */
    private array $ignored;

    /**
     * @param array<int, array{id: int, names: string[]}> $drinks
     * @param string[] $ignoredWords words that don't identify a drink
     */
    public function __construct(array $drinks, array $ignoredWords = [])
    {
        $this->ignored = array_fill_keys(array_map('mb_strtolower', $ignoredWords), true);

        foreach ($drinks as $drink) {
            $seen = [];
            foreach ($drink['names'] as $name) {
                $words = $this->words((string) $name);
                $key   = implode(' ', $words);
                if ($words === [] || isset($seen[$key])) {
                    continue;
                }
                $seen[$key]    = true;
                $this->names[] = ['id' => (int) $drink['id'], 'words' => $words];
            }
        }

        // Longest name first; then by drink id so the result never depends on input order.
        usort($this->names, fn ($a, $b) => [count($b['words']), $a['id'], $a['words']] <=> [count($a['words']), $b['id'], $b['words']]);
    }

    /**
     * @param array<int, array{text: string, name: string, price: ?float, page?: int}> $rows from MenuReader
     * @return array<int, array{text: string, price: ?float, page: int, kind: string, recipe_id: ?int, share: ?float}>
     *         one entry per drink found on a row; a row with a price and no
     *         drink is "unrecognised"; other rows are left out
     */
    public function match(array $rows): array
    {
        $items = [];

        foreach ($rows as $row) {
            $words = $this->words($row['name']);
            $base  = ['text' => $row['text'], 'price' => $row['price'], 'page' => (int) ($row['page'] ?? 0)];

            if ($words === [] || self::isDescription($row)) {
                continue;
            }

            $found = $this->drinksIn($words, $row['price'] !== null);

            foreach ($found as $match) {
                $items[] = $base + ['kind' => 'matched', 'recipe_id' => $match['id'], 'share' => $match['share']];
            }

            if ($found === [] && $row['price'] !== null) {
                $items[] = $base + ['kind' => 'unrecognised', 'recipe_id' => null, 'share' => null];
            }
        }

        return $items;
    }

    /**
     * The words that identify a drink: lower case, no accents or punctuation,
     * no numbers, none of the ignored words.
     *
     * @return string[]
     */
    public function words(string $text): array
    {
        $text = mb_strtolower($text);
        $text = strtr($text, ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'á' => 'a', 'à' => 'a', 'â' => 'a', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'ü' => 'u', 'ú' => 'u', 'í' => 'i', 'ï' => 'i', 'ñ' => 'n', 'ç' => 'c', '’' => "'"]);
        $text = preg_replace("/'s\b/u", '', $text);
        $text = preg_replace('/[^a-z0-9]+/u', ' ', $text);

        $words = [];
        foreach (explode(' ', trim($text)) as $word) {
            if ($word === '' || ctype_digit($word) || isset($this->ignored[$word])) {
                continue;
            }
            $words[] = $word;
        }

        return $words;
    }

    /**
     * @param string[] $words the row's words
     * @return array<int, array{id: int, share: float}> drinks named on the row, each once
     */
    private function drinksIn(array $words, bool $hasPrice): array
    {
        $total = count($words);
        $left  = $words;
        $found = [];

        while ($left !== []) {
            $best = null;

            foreach ($this->names as $name) {
                if (count($name['words']) > count($left) || isset($found[$name['id']])) {
                    continue;
                }

                $used = $this->uses($name['words'], $left);
                if ($used !== null) {
                    // Names are sorted longest first, so the first fit is the best one.
                    $best = ['id' => $name['id'], 'used' => $used, 'share' => count($name['words']) / $total];
                    break;
                }
            }

            if ($best === null) {
                break;
            }

            $found[$best['id']] = ['id' => $best['id'], 'share' => round($best['share'], 3)];
            foreach ($best['used'] as $index) {
                unset($left[$index]);
            }
        }

        $found = array_values($found);

        // Without a price the names must make up most of the row, or it is a description.
        if (!$hasPrice && array_sum(array_column($found, 'share')) < self::MIN_SHARE_WITHOUT_PRICE) {
            return [];
        }

        return $found;
    }

    /**
     * Which of the row's words a name uses, or null when a word is missing.
     *
     * @param string[] $name
     * @param array<int, string> $row keyed by position
     * @return int[]|null
     */
    private function uses(array $name, array $row): ?array
    {
        $used = [];

        foreach ($name as $word) {
            $hit = null;

            foreach ($row as $index => $candidate) {
                if (!isset($used[$index]) && $candidate === $word) {
                    $hit = $index;
                    break;
                }
            }

            if ($hit === null) {
                foreach ($row as $index => $candidate) {
                    if (!isset($used[$index]) && self::nearly($word, $candidate)) {
                        $hit = $index;
                        break;
                    }
                }
            }

            if ($hit === null) {
                return null;
            }

            $used[$hit] = true;
        }

        return array_keys($used);
    }

    /**
     * A letter or two added, missing or swapped, in words long enough for that
     * to be a misread and not another word: one from 5 letters, two from 9.
     */
    private static function nearly(string $a, string $b): bool
    {
        $shorter = min(strlen($a), strlen($b));
        if ($shorter < self::FUZZY_FROM) {
            return false;
        }

        $allowed = $shorter >= self::FUZZY_TWO_FROM ? 2 : 1;

        return abs(strlen($a) - strlen($b)) <= $allowed && levenshtein($a, $b) <= $allowed;
    }

    /**
     * "chai tea, lemon juice": a row with no price that starts in lower case
     * and lists things is a description of the drink above, not a drink.
     */
    private static function isDescription(array $row): bool
    {
        $text = ltrim((string) $row['text'], " \t-•·*");

        return $row['price'] === null && preg_match('/^\p{Ll}/u', $text) === 1 && str_contains($text, ',');
    }
}
