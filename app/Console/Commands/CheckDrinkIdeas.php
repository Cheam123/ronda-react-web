<?php

namespace App\Console\Commands;

use App\Models\Leads;
use App\Services\Menu\IdeasCheck;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Runs the drink ideas over every outlet and reports how they behave: see
 * IdeasCheck for what each number means. The result is also saved for the
 * admin Drinks page.
 *
 *     php artisan ideas:check
 */
class CheckDrinkIdeas extends Command
{
    protected $signature = 'ideas:check {--no-save : Print only; keep the last saved result}';

    protected $description = 'Check how the drink ideas behave across every outlet';

    /** Where the newest result is kept, for the admin Drinks page. */
    public static function resultPath(): string
    {
        return (string) (config('ife.recommendation.menu.check_path') ?: storage_path('app/reports/ideas-check.json'));
    }

    /** The newest saved result, or null before the first check. */
    public static function lastResult(): ?array
    {
        $path = self::resultPath();

        return is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
    }

    public function handle(IdeasCheck $check): int
    {
        $result = $check->run(Leads::query()->orderBy('id')->lazy());

        $pct = fn (?float $value) => $value === null ? '—' : round($value * 100) . '%';

        $this->info("Outlets: {$result['outlets']}, with at least one idea: {$result['with_ideas']} ({$pct($result['with_ideas'] / max(1, $result['outlets']))}), ideas each: {$result['ideas_per_outlet']}");
        $this->info("Drinks suggested: {$result['drinks_suggested']} of {$result['drinks_active']} active drinks");
        $this->table(['Most suggested', 'Outlets', 'Share of outlets'], array_map(fn ($row) => [$row['name'], $row['outlets'], $pct($row['share'])], $result['top_drinks']));

        $this->table(
            ['Fit (0 to 100%)', 'Outlets', 'Top ideas', 'Same type', 'Random'],
            [
                ['What the owner said', $result['needs']['outlets'], $pct($result['needs']['engine']), $pct($result['needs']['same_type']), $pct($result['needs']['random'])],
                ['Places around them', $result['area']['outlets'], $pct($result['area']['engine']), $pct($result['area']['same_type']), $pct($result['area']['random'])],
            ]
        );
        $this->info("The needs change the top ideas at {$pct($result['needs']['changed'])} of the outlets that have them.");

        $answers = $result['answers'];
        $this->info("Answers: {$answers['pitched']} pitched, {$answers['accepted']} accepted, {$answers['declined']} declined; accepted {$pct($answers['acceptance'])} of decided.");

        if (!$this->option('no-save')) {
            File::ensureDirectoryExists(dirname(self::resultPath()));
            File::put(self::resultPath(), json_encode($result, JSON_PRETTY_PRINT));
            $this->line('Saved for the admin Drinks page.');
        }

        return self::SUCCESS;
    }
}
