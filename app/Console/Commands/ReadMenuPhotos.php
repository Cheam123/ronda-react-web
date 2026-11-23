<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Services\Menu\MenuScanService;
use App\Services\Menu\TextractPhotoReader;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Reads menu photos with Amazon Textract and shows the lines and the drinks
 * found, to compare with what the phone read. --save writes the lines in the
 * phone's "Copy the text" format, so "menu:check" can score them against an
 * answer list.
 *
 *     php artisan menu:read photos/menu1.jpg photos/menu1b.jpg --save=storage/app/menus/menu1.txt
 *
 * Needs TEXTRACT_KEY and TEXTRACT_SECRET; each photo costs about
 * USD 0.004 and counts towards nothing in the app.
 */
class ReadMenuPhotos extends Command
{
    protected $signature = 'menu:read {photos* : One to four photos of the same menu, in order} {--save= : Write the lines here, as the phone copies them}';

    protected $description = 'Read menu photos with Amazon Textract, to compare with the phone';

    public function handle(TextractPhotoReader $reader, MenuScanService $scans): int
    {
        if (!TextractPhotoReader::configured()) {
            $this->error('Amazon Textract is not set up: add TEXTRACT_KEY and TEXTRACT_SECRET to .env (an IAM user access key).');

            return self::FAILURE;
        }

        $paths = array_slice((array) $this->argument('photos'), 0, 4);
        foreach ($paths as $path) {
            if (!is_file($path)) {
                $this->error("There is no photo at {$path}.");

                return self::FAILURE;
            }
        }

        try {
            $fragments = $reader->read($paths);
        } catch (\Throwable $e) {
            $this->error('Textract could not read the photos: ' . $e->getMessage());

            return self::FAILURE;
        }

        $this->info(count($fragments) . ' lines from ' . count($paths) . ' photos.');

        $names = Recipe::pluck('name', 'id')->all();
        $rows  = array_map(fn (array $item) => [
            $item['text'],
            $item['price'] === null ? '' : number_format($item['price'], 2),
            $item['kind'] === 'matched' ? ($names[$item['recipe_id']] ?? '') : 'not recognised',
        ], $scans->findDrinks($fragments));
        $this->table(['Row', 'Price', 'Drink'], $rows);

        if ($save = $this->option('save')) {
            $text = collect($fragments)->groupBy('page')->map(fn ($lines, $page) => implode("\n", array_merge(
                ['Photo ' . ($page + 1) . ' (x,y,width,height | text)'],
                $lines->map(fn ($line) => "{$line['x']},{$line['y']},{$line['width']},{$line['height']} | {$line['text']}")->all()
            )))->implode("\n\n");

            File::ensureDirectoryExists(dirname($save));
            File::put($save, $text . "\n");
            $this->line("Saved to {$save}. Add the drinks really on it to " . preg_replace('/\.txt$/', '', $save) . '.answer.txt, then run menu:check on the folder.');
        }

        return self::SUCCESS;
    }
}
