<?php

namespace Tests\Unit;

use App\Services\Menu\MenuReader;
use App\Services\Menu\TextractPhotoReader;
use Aws\MockHandler;
use Aws\Result;
use Aws\Textract\TextractClient;
use PHPUnit\Framework\TestCase;

/** Reading menu photos with Amazon Textract, against a stand-in for AWS (nothing is sent). */
class TextractPhotoReaderTest extends TestCase
{
    /** A two-column menu: Latte and Mocha at the same height in two layout blocks, each with its price beside it. */
    private function blocks(): array
    {
        $line = fn (string $id, string $text, float $left, float $top, float $width = 0.2) => [
            'BlockType' => 'LINE', 'Id' => $id, 'Text' => $text,
            'Geometry'  => ['BoundingBox' => ['Left' => $left, 'Top' => $top, 'Width' => $width, 'Height' => 0.04]],
        ];

        return [
            ['BlockType' => 'PAGE', 'Id' => 'page'],
            ['BlockType' => 'LAYOUT_LIST', 'Id' => 'left', 'Relationships' => [['Type' => 'CHILD', 'Ids' => ['l1', 'l2']]]],
            ['BlockType' => 'LAYOUT_LIST', 'Id' => 'right', 'Relationships' => [['Type' => 'CHILD', 'Ids' => ['r1', 'r2']]]],
            $line('l1', 'Latte', 0.05, 0.20),
            $line('l2', '10.00', 0.30, 0.201, 0.08),
            $line('r1', 'Mocha', 0.55, 0.20),
            $line('r2', '12.00', 0.80, 0.201, 0.08),
            ['BlockType' => 'WORD', 'Id' => 'w1', 'Text' => 'Latte'],
        ];
    }

    public function test_lines_become_fragments_in_pixels_with_their_layout_block(): void
    {
        $lines = TextractPhotoReader::linesFrom($this->blocks(), 1, 1000, 2000);

        $this->assertCount(4, $lines, 'words and layout blocks are not lines');
        $this->assertSame(['text' => 'Latte', 'page' => 1, 'x' => 50, 'y' => 400, 'width' => 200, 'height' => 80, 'group' => '1:left'], $lines[0]);
        $this->assertSame('1:right', $lines[2]['group']);
    }

    public function test_the_columns_of_a_menu_stay_apart_but_a_price_joins_its_name(): void
    {
        $rows = (new MenuReader())->rows(TextractPhotoReader::linesFrom($this->blocks(), 0, 1000, 1000));

        $this->assertSame(
            [['Latte', 10.0], ['Mocha', 12.0]],
            array_map(fn (array $row) => [$row['name'], $row['price']], $rows)
        );

        // Without the layout, the two columns run together into one row.
        $plain = array_map(fn (array $line) => array_diff_key($line, ['group' => 1]), TextractPhotoReader::linesFrom($this->blocks(), 0, 1000, 1000));
        $this->assertCount(1, (new MenuReader())->rows($plain));
    }

    public function test_each_photo_is_sent_as_bytes_with_the_layout_feature(): void
    {
        $mock   = new MockHandler([new Result(['Blocks' => $this->blocks()]), new Result(['Blocks' => $this->blocks()])]);
        $client = new TextractClient(['version' => '2018-06-27', 'region' => 'ap-southeast-1', 'credentials' => ['key' => 'test', 'secret' => 'test'], 'handler' => $mock]);

        $photo = tempnam(sys_get_temp_dir(), 'menu');
        $image = imagecreatetruecolor(400, 800);
        imagejpeg($image, $photo);

        $lines = (new TextractPhotoReader($client))->read([$photo, $photo]);

        $this->assertCount(8, $lines);
        $this->assertSame([0, 0, 0, 0, 1, 1, 1, 1], array_column($lines, 'page'));
        $this->assertSame(20, $lines[0]['x'], 'positions use the photo size: 5% of 400 px');
        $this->assertSame(['LAYOUT'], $mock->getLastCommand()['FeatureTypes']);
        $this->assertSame(file_get_contents($photo), $mock->getLastCommand()['Document']['Bytes']);

        unlink($photo);
    }
}
