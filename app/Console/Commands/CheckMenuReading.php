<?php

namespace App\Console\Commands;

use App\Services\Menu\MenuCheck;
use Illuminate\Console\Command;

/**
 * How accurately menus are read and matched to drinks (see MenuCheck).
 *
 *     php artisan menu:check                   the sample menus in database/data/menu_samples.json
 *     php artisan menu:check storage/app/menus a folder of real readings
 *
 * In a folder, each menu is two files: name.txt, what the phone's "Copy the
 * text" gave (or a typed menu), and name.answer.txt, the drinks that are
 * really on it, one per line, by name or another name.
 */
class CheckMenuReading extends Command
{
    protected $signature = 'menu:check {folder? : A folder of name.txt readings with name.answer.txt answer lists}';

    protected $description = 'Check how accurately menus are read and matched to drinks';

    public function handle(MenuCheck $check): int
    {
        $folder = $this->argument('folder');
        $menus  = $folder ? $this->fromFolder($folder) : $this->samples();
        if ($menus === null) {
            return self::FAILURE;
        }
        if ($menus === []) {
            $this->error('No menus to check: put name.txt and name.answer.txt pairs in the folder.');

            return self::FAILURE;
        }

        if (!$folder) {
            $this->warn('Checking the sample menus, which the author wrote. For real accuracy, give a folder of readings copied from the phone.');
        }

        $result = $check->run($menus);

        foreach ($result['menus'] as $menu) {
            $this->line('');
            $this->info($menu['name']);
            $this->line('  Right:  ' . ($menu['right'] ? implode(', ', $menu['right']) : 'none'));
            $this->line('  Missed: ' . ($menu['missed'] ? implode(', ', $menu['missed']) : 'none'));
            $this->line('  Wrong:  ' . ($menu['wrong'] ? implode(', ', $menu['wrong']) : 'none'));
            if ($menu['unrecognised']) {
                $this->line('  Not recognised: ' . implode(' / ', $menu['unrecognised']));
            }
        }

        $pct = fn (?float $value) => $value === null ? '—' : round($value * 100) . '%';
        $this->line('');
        $this->table(['Menus', 'Right', 'Missed', 'Wrong', 'Precision', 'Recall'], [[
            count($result['menus']), $result['right'], $result['missed'], $result['wrong'], $pct($result['precision']), $pct($result['recall']),
        ]]);

        if ($result['unknown_answers']) {
            $this->warn('Not one of the drinks, so left out of the answers: ' . implode(', ', $result['unknown_answers']));
        }

        return self::SUCCESS;
    }

    /** @return array<int, array{name: string, fragments: array, answer: string[]}>|null */
    private function fromFolder(string $folder): ?array
    {
        $path = is_dir($folder) ? $folder : base_path($folder);
        if (!is_dir($path)) {
            $this->error("There is no folder at {$folder}.");

            return null;
        }

        $menus = [];
        foreach (glob(rtrim($path, '/\\') . '/*.txt') ?: [] as $file) {
            if (str_ends_with($file, '.answer.txt')) {
                continue;
            }
            $answerFile = substr($file, 0, -4) . '.answer.txt';
            if (!is_file($answerFile)) {
                $this->warn('Skipped ' . basename($file) . ': it has no ' . basename($answerFile) . '.');
                continue;
            }

            $menus[] = [
                'name'      => basename($file, '.txt'),
                'fragments' => MenuCheck::fragmentsFromCopy((string) file_get_contents($file)),
                'answer'    => array_values(array_filter(array_map('trim', file($answerFile) ?: []))),
            ];
        }

        return $menus;
    }

    /** @return array<int, array{name: string, fragments: array, answer: string[]}> */
    private function samples(): array
    {
        $data = json_decode((string) file_get_contents(database_path('data/menu_samples.json')), true);

        return array_map(fn (array $menu) => [
            'name'      => $menu['name'],
            'fragments' => MenuCheck::fragmentsFromCopy($menu['text']),
            'answer'    => $menu['answer'],
        ], $data['menus'] ?? []);
    }
}
