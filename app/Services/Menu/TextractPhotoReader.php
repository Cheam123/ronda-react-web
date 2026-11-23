<?php

namespace App\Services\Menu;

use App\Models\DocumentUpload;
use App\Models\MenuScan;
use Aws\Textract\TextractClient;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * Reads menu photos with Amazon Textract (AnalyzeDocument with the LAYOUT
 * feature, the photo sent as bytes, so no S3 bucket is needed).
 *
 * Each LINE becomes a fragment, with its box in pixels and the layout block it
 * sits in as its group, so MenuReader keeps the columns of a menu apart.
 * Off until an access key is set (see ife.recommendation.menu.textract).
 */
final class TextractPhotoReader implements PhotoReader
{
    public function __construct(private ?TextractClient $client = null)
    {
    }

    /** Whether the app reads photos with Textract: chosen, and with a key. */
    public static function enabled(): bool
    {
        return config('ife.recommendation.menu.reader') === 'textract' && self::configured();
    }

    public static function configured(): bool
    {
        $settings = (array) config('ife.recommendation.menu.textract', []);

        return !empty($settings['key']) && !empty($settings['secret']);
    }

    /** Photos read with Textract so far this calendar month. */
    public static function photosThisMonth(): int
    {
        return DocumentUpload::query()
            ->whereIn('menu_scan_id', MenuScan::where('source', MenuScan::SOURCE_TEXTRACT)->select('id'))
            ->where('created_at', '>=', Carbon::now()->startOfMonth())
            ->count();
    }

    /** Whether reading $count more photos stays within this month's limit. */
    public static function withinLimit(int $count): bool
    {
        $limit = (int) config('ife.recommendation.menu.textract.monthly_photos', 300);

        return self::photosThisMonth() + $count <= $limit;
    }

    public function read(array $paths): array
    {
        $fragments = [];

        foreach (array_values($paths) as $page => $path) {
            $bytes = @file_get_contents($path);
            if ($bytes === false) {
                throw new RuntimeException("The photo {$path} could not be opened.");
            }

            // Textract gives positions as shares of the photo; pixels keep them like the phone's.
            $size   = @getimagesizefromstring($bytes) ?: [1000, 1000];
            $result = $this->client()->analyzeDocument([
                'Document'     => ['Bytes' => $bytes],
                'FeatureTypes' => ['LAYOUT'],
            ]);

            $fragments = array_merge($fragments, self::linesFrom((array) $result->get('Blocks'), $page, (int) $size[0], (int) $size[1]));
        }

        return $fragments;
    }

    /**
     * Textract's blocks for one photo as fragments: each LINE, with the LAYOUT
     * block that lists it as a child as its group.
     */
    public static function linesFrom(array $blocks, int $page, int $width, int $height): array
    {
        $groups = [];
        foreach ($blocks as $block) {
            if (!str_starts_with((string) ($block['BlockType'] ?? ''), 'LAYOUT_')) {
                continue;
            }
            foreach ($block['Relationships'] ?? [] as $relation) {
                if (($relation['Type'] ?? null) === 'CHILD') {
                    foreach ($relation['Ids'] ?? [] as $id) {
                        $groups[$id] ??= (string) $block['Id'];
                    }
                }
            }
        }

        $lines = [];
        foreach ($blocks as $block) {
            if (($block['BlockType'] ?? null) !== 'LINE' || trim((string) ($block['Text'] ?? '')) === '') {
                continue;
            }

            $box  = $block['Geometry']['BoundingBox'] ?? [];
            $line = [
                'text'   => (string) $block['Text'],
                'page'   => $page,
                'x'      => (int) round(($box['Left'] ?? 0) * $width),
                'y'      => (int) round(($box['Top'] ?? 0) * $height),
                'width'  => (int) round(($box['Width'] ?? 0) * $width),
                'height' => (int) round(($box['Height'] ?? 0) * $height),
            ];
            if (isset($groups[$block['Id'] ?? ''])) {
                $line['group'] = $page . ':' . $groups[$block['Id']];
            }
            $lines[] = $line;
        }

        return $lines;
    }

    private function client(): TextractClient
    {
        if ($this->client) {
            return $this->client;
        }
        if (!self::configured()) {
            throw new RuntimeException('Amazon Textract is not set up: add TEXTRACT_KEY and TEXTRACT_SECRET to .env (an IAM user access key).');
        }

        $settings = (array) config('ife.recommendation.menu.textract');

        return $this->client = new TextractClient([
            'version'     => '2018-06-27',
            'region'      => $settings['region'] ?? 'ap-southeast-1',
            'credentials' => ['key' => $settings['key'], 'secret' => $settings['secret']],
        ]);
    }
}
