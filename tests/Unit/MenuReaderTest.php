<?php

namespace Tests\Unit;

use App\Services\Menu\MenuReader;
use PHPUnit\Framework\TestCase;

/** Rows and prices from what a phone read, or from a typed menu. */
class MenuReaderTest extends TestCase
{
    private function reader(): MenuReader
    {
        return new MenuReader();
    }

    public function test_a_name_and_a_price_in_separate_columns_become_one_row(): void
    {
        $rows = $this->reader()->rows([
            // Read as two blocks: the names on the left, the prices on the right.
            ['text' => 'Iced Latte', 'page' => 0, 'x' => 40, 'y' => 100, 'width' => 200, 'height' => 30],
            ['text' => 'Mocha', 'page' => 0, 'x' => 40, 'y' => 150, 'width' => 120, 'height' => 30],
            ['text' => '12.90', 'page' => 0, 'x' => 600, 'y' => 104, 'width' => 80, 'height' => 28],
            ['text' => '14.00', 'page' => 0, 'x' => 600, 'y' => 153, 'width' => 80, 'height' => 28],
        ]);

        $this->assertSame(['Iced Latte 12.90', 'Mocha 14.00'], array_column($rows, 'text'));
        $this->assertSame(['Iced Latte', 'Mocha'], array_column($rows, 'name'));
        $this->assertSame([12.9, 14.0], array_column($rows, 'price'));
    }

    public function test_rows_on_different_photos_are_never_joined(): void
    {
        $rows = $this->reader()->rows([
            ['text' => 'Latte', 'page' => 0, 'x' => 40, 'y' => 100, 'width' => 200, 'height' => 30],
            ['text' => '9.00', 'page' => 1, 'x' => 600, 'y' => 100, 'width' => 80, 'height' => 30],
        ]);

        $this->assertSame(['Latte', '9.00'], array_column($rows, 'text'));
        $this->assertSame([0, 1], array_column($rows, 'page'));
    }

    public function test_prices_are_read_in_the_ways_menus_write_them(): void
    {
        $cases = [
            'Spanish Latte RM 13.90'     => ['Spanish Latte', 13.9],
            'Spanish Latte RM13'         => ['Spanish Latte', 13.0],
            'Matcha Latte ..... 15'      => ['Matcha Latte', 15.0],
            'Americano 9 / 11'           => ['Americano', 9.0],
            'Teh Tarik 3,50'             => ['Teh Tarik', 3.5],
            'Hot 8.90 Iced 9.90 Mocha'   => ['Hot Iced Mocha', 8.9],
            'V60 Pour Over 18.00'        => ['V60 Pour Over', 18.0],
            'Signature Drinks'           => ['Signature Drinks', null],
            'Call 03 9101 2345'          => ['Call 03 9101 2345', null],
            'Since 1998'                 => ['Since 1998', null],
        ];

        foreach ($cases as $line => [$name, $price]) {
            $row = $this->reader()->rowsFromText($line)[0];
            $this->assertSame($name, $row['name'], $line);
            $this->assertSame($price, $row['price'], $line);
        }
    }

    public function test_letters_misread_as_digits_in_a_price_are_put_right(): void
    {
        $price = fn (string $line) => $this->reader()->rowsFromText($line)[0]['price'];

        $this->assertSame(13.0, $price('Cappuccino 1B.00'), 'B for 3, as in the first trial');
        $this->assertSame(12.5, $price('Latte l2.50'));
        $this->assertSame(10.0, $price('Mocha RM 1O'));
        $this->assertSame(13.0, $price('Spanish Latte 1B,OO'));
        $this->assertNull($price('Mineral Water 1.5l'), 'a bottle size stays a size');
        $this->assertSame('BOS', $this->reader()->rowsFromText('BOS 12')[0]['name'], 'words are never changed');
    }

    public function test_a_typed_menu_is_one_row_per_line_and_blank_lines_are_dropped(): void
    {
        $rows = $this->reader()->rowsFromText("Latte 10\n\n  Cappuccino 10  \r\nFlat White 11");

        $this->assertSame(['Latte 10', 'Cappuccino 10', 'Flat White 11'], array_column($rows, 'text'));
    }

    public function test_the_middle_price_ignores_rows_without_one(): void
    {
        $this->assertSame(10.0, MenuReader::medianPrice([8.0, null, 10.0, 15.0]));
        $this->assertSame(9.0, MenuReader::medianPrice([8.0, 10.0]));
        $this->assertNull(MenuReader::medianPrice([null]));
    }
}
