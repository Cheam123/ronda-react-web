<?php

namespace Tests\Unit;

use App\Services\Menu\MenuMatcher;
use App\Services\Menu\MenuReader;
use PHPUnit\Framework\TestCase;

/** Which drinks a menu row names, with reading errors, other names and rows that name several. */
class MenuMatcherTest extends TestCase
{
    private const IGNORED = ['hot', 'iced', 'ice', 'cold', 'regular', 'large', 'ais', 'panas', 'and', 'with'];

    private const DRINKS = [
        ['id' => 1, 'names' => ['Latte']],
        ['id' => 2, 'names' => ['Iced Vanilla Latte', 'Vanilla Latte']],
        ['id' => 3, 'names' => ['Matcha Latte', 'Matcha', 'Green Tea Latte']],
        ['id' => 4, 'names' => ['Strawberry Matcha Latte', 'Strawberry Matcha']],
        ['id' => 5, 'names' => ['Cappuccino']],
        ['id' => 6, 'names' => ['Flat White']],
        ['id' => 7, 'names' => ['Teh O Ais Limau', 'Lemon Tea']],
        ['id' => 8, 'names' => ['Teh O']],
        ['id' => 9, 'names' => ['Espresso']],
        ['id' => 10, 'names' => ['Iced Peach Green Tea', 'Peach Tea']],
    ];

    /** @return array<int, array> the matcher's items for a typed menu */
    private function read(string $menu): array
    {
        return (new MenuMatcher(self::DRINKS, self::IGNORED))->match((new MenuReader())->rowsFromText($menu));
    }

    /** @return array<string, int[]> row text => drink ids found on it */
    private function found(string $menu): array
    {
        $found = [];
        foreach ($this->read($menu) as $item) {
            if ($item['kind'] === 'matched') {
                $found[$item['text']][] = $item['recipe_id'];
            }
        }

        return $found;
    }

    public function test_a_drink_is_found_by_its_name_or_another_name_whatever_the_case_or_serve(): void
    {
        $this->assertSame([
            'LATTE 10'               => [1],
            'Hot Vanilla Latte 12'   => [2],
            'iced vanilla latte 13'  => [2],
            'Green Tea Latte 13'     => [3],
            'Lemon Tea (Iced) 6'     => [7],
        ], $this->found("LATTE 10\nHot Vanilla Latte 12\niced vanilla latte 13\nGreen Tea Latte 13\nLemon Tea (Iced) 6"));
    }

    public function test_the_longest_name_wins(): void
    {
        $this->assertSame([
            'Strawberry Matcha Latte 15' => [4],
            'Matcha Latte 13'            => [3],
            'Teh O Ais Limau 4'          => [7],
            'Teh O 2.50'                 => [8],
        ], $this->found("Strawberry Matcha Latte 15\nMatcha Latte 13\nTeh O Ais Limau 4\nTeh O 2.50"));
    }

    public function test_words_may_be_in_another_order(): void
    {
        $this->assertSame(['Latte Vanilla 12' => [2], 'Matcha Strawberry 15' => [4]], $this->found("Latte Vanilla 12\nMatcha Strawberry 15"));
    }

    public function test_one_misread_letter_in_a_long_word_still_matches_but_a_short_word_must_be_exact(): void
    {
        $this->assertSame([
            'Cappucino 11'     => [5],
            'Vanila Latte 12'  => [2],
            'Strawbery Matcha' => [4],
            // "Tea O" is not "Teh O": a three-letter word has to be exact.
        ], $this->found("Cappucino 11\nVanila Latte 12\nStrawbery Matcha\nTea O 3"));
    }

    public function test_two_misread_letters_still_match_in_a_long_word_but_not_a_middling_one(): void
    {
        $this->assertSame([
            'Oappucoino 11'        => [5],
            'Strawbcrry Matcha 14' => [4],
            // "Esprcsco" is two letters off an 8-letter word: too far, so it stays unrecognised.
        ], $this->found("Oappucoino 11\nStrawbcrry Matcha 14\nEsprcsco 7"));
    }

    public function test_a_lower_case_list_with_no_price_is_a_description_not_a_drink(): void
    {
        $found = $this->found("Iced Peach Green Tea 12\npeach, green tea, lemon\nchai tea, lemon tea\nLatte, Cappuccino");

        $this->assertSame(['Iced Peach Green Tea 12' => [10], 'Latte, Cappuccino' => [1, 5]], $found);
    }

    public function test_a_row_naming_several_drinks_gives_each_of_them_once(): void
    {
        $this->assertSame(
            ['Latte / Cappuccino / Flat White 11' => [6, 1, 5]],
            $this->found('Latte / Cappuccino / Flat White 11')
        );
    }

    public function test_a_priced_row_with_no_known_drink_is_kept_as_unrecognised(): void
    {
        $items = $this->read("Yuzu Americano 14\nNasi Lemak 9.90");

        $this->assertSame(['unrecognised', 'unrecognised'], array_column($items, 'kind'));
        $this->assertSame(['Yuzu Americano 14', 'Nasi Lemak 9.90'], array_column($items, 'text'));
        $this->assertSame([14.0, 9.9], array_column($items, 'price'));
    }

    public function test_headings_and_descriptions_are_left_out(): void
    {
        $items = $this->read("COFFEE\nOur espresso is roasted weekly in Kuala Lumpur by people who care\nEspresso\nAll prices include service charge");

        // The description mentions espresso but is mostly other words; the bare name counts.
        $this->assertSame(['Espresso'], array_column($items, 'text'));
        $this->assertSame([9], array_column($items, 'recipe_id'));
    }

    public function test_a_drink_with_extra_words_still_counts_when_the_row_has_a_price(): void
    {
        $this->assertSame(['Rose Latte with oat milk 14' => [1]], $this->found('Rose Latte with oat milk 14'));
    }

    public function test_the_result_does_not_depend_on_the_order_drinks_are_given_in(): void
    {
        $menu     = "Peach Tea 9\nGreen Tea Latte 13\nStrawberry Matcha Latte 15\nLatte 10";
        $reversed = (new MenuMatcher(array_reverse(self::DRINKS), self::IGNORED))->match((new MenuReader())->rowsFromText($menu));

        $this->assertSame($this->read($menu), $reversed);
    }
}
