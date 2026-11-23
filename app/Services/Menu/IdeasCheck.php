<?php

namespace App\Services\Menu;

use App\Models\Leads;
use App\Models\RecommendationFeedback;
use Illuminate\Support\Carbon;

/**
 * How the drink ideas behave across every outlet, and what reps did with them.
 *
 * There is no record yet of which drinks outlets went on to sell, so this
 * cannot say whether an idea was right. It checks what can be checked:
 *
 *   coverage    how many outlets get at least one idea, and how many each
 *   variety     how many different drinks are suggested, and the most common
 *   needs fit   how well the top ideas meet what the owner said (the needs
 *               part, 0 to 1), against two simple ways of picking 3 drinks:
 *               any drink the outlet can take (random) and drinks tagged for
 *               its type (same type, the old engine's baseline)
 *   area fit    the same for the places around the outlet
 *   needs used  how often the needs change the top ideas, against the same
 *               outlet ranked without them
 *   answers     the reps' newest answer on each idea: pitched, accepted,
 *               declined, and accepted out of accepted plus declined
 *
 * The first five come from the ranking alone; only the answers come from
 * reps, so on a demo database they show how the report works, not results.
 */
final class IdeasCheck
{
    public function __construct(private MenuScanService $scans)
    {
    }

    /** @param iterable<Leads> $leads */
    public function run(iterable $leads): array
    {
        $drinks = $this->scans->drinkFacts();
        $active = count(array_filter($drinks, fn (array $drink) => $drink['is_active']));
        $top    = $this->scans->ranker();
        $every  = $this->scans->ranker(['limit' => PHP_INT_MAX, 'min_score' => 0]);

        $outlets   = 0;
        $withIdeas = 0;
        $ideaCount = 0;
        $byDrink   = [];
        $fit       = ['needs' => [], 'area' => []];
        $changed   = [];

        foreach ($leads as $lead) {
            $outlets++;
            [$outlet, $declined, $bought] = $this->scans->rankingInputs($lead);
            $menu = MenuScanService::menuOf($this->scans->currentScan($lead));

            $ideas = $top->rank($outlet, $menu, $drinks, $declined, $bought);
            if ($ideas === []) {
                continue;
            }
            $withIdeas++;
            $ideaCount += count($ideas);
            foreach ($ideas as $idea) {
                $byDrink[$idea['name']] = ($byDrink[$idea['name']] ?? 0) + 1;
            }

            $all = $every->rank($outlet, $menu, $drinks, $declined, $bought);
            foreach (['needs', 'area'] as $part) {
                $row = self::fit($part, $ideas, $all);
                if ($row !== null) {
                    $fit[$part][] = $row;
                }
            }

            $hasNeeds = $outlet['best_sellers'] !== [] || $outlet['goals'] !== [] || $outlet['typical_price'] !== null;
            if ($hasNeeds) {
                $without   = $top->rank(['best_sellers' => [], 'goals' => [], 'typical_price' => null] + $outlet, $menu, $drinks, $declined, $bought);
                $changed[] = self::ids($ideas) !== self::ids($without);
            }
        }

        arsort($byDrink);

        return [
            'checked_at'       => Carbon::now()->toIso8601String(),
            'outlets'          => $outlets,
            'with_ideas'       => $withIdeas,
            'ideas_per_outlet' => $withIdeas ? round($ideaCount / $withIdeas, 2) : 0.0,
            'drinks_suggested' => count($byDrink),
            'drinks_active'    => $active,
            'top_drinks'       => array_map(
                fn (string $name, int $count) => ['name' => $name, 'outlets' => $count, 'share' => round($count / max(1, $withIdeas), 3)],
                array_slice(array_keys($byDrink), 0, 5),
                array_slice(array_values($byDrink), 0, 5)
            ),
            'needs'            => self::summary($fit['needs']) + ['changed' => $changed === [] ? null : round(count(array_filter($changed)) / count($changed), 3)],
            'area'             => self::summary($fit['area']),
            'answers'          => self::answers(),
        ];
    }

    /**
     * One outlet's fit for a part: the top ideas' average, every drink's
     * average (random) and the average of drinks tagged for its type.
     *
     * @return array{engine: float, random: float, same_type: ?float}|null
     */
    private static function fit(string $part, array $ideas, array $all): ?array
    {
        // Only drinks the part could judge count, in the ideas as in the baselines.
        $scored = fn (array $rows) => array_values(array_filter($rows, fn (array $idea) => isset($idea['parts'][$part])));
        $mean   = fn (array $rows) => $rows === [] ? null : array_sum(array_map(fn ($idea) => $idea['parts'][$part], $rows)) / count($rows);

        $top = $scored($ideas);
        if ($top === []) {
            return null;
        }
        $every = $scored($all);

        return [
            'engine'    => $mean($top),
            'random'    => $mean($every),
            'same_type' => $mean(array_values(array_filter($every, fn (array $idea) => ($idea['parts']['type'] ?? null) === 1.0))),
        ];
    }

    /** @param array<int, array{engine: float, random: float, same_type: ?float}> $rows */
    private static function summary(array $rows): array
    {
        $average = function (string $key) use ($rows): ?float {
            $values = array_filter(array_column($rows, $key), fn ($value) => $value !== null);

            return $values === [] ? null : round(array_sum($values) / count($values), 3);
        };

        return ['outlets' => count($rows), 'engine' => $average('engine'), 'same_type' => $average('same_type'), 'random' => $average('random')];
    }

    /** The newest answer on each idea at each outlet. */
    private static function answers(): array
    {
        $counts  = ['pitched' => 0, 'accepted' => 0, 'declined' => 0];
        $reasons = [];
        foreach (RecommendationFeedback::latestDrinksByLead() as $drinks) {
            foreach ($drinks as $row) {
                if (!isset($counts[$row->status])) {
                    continue;
                }
                $counts[$row->status]++;
                if ($row->status === 'declined') {
                    $label           = RecommendationFeedback::REASONS[$row->reason] ?? 'No reason given';
                    $reasons[$label] = ($reasons[$label] ?? 0) + 1;
                }
            }
        }
        arsort($reasons);
        $decided = $counts['accepted'] + $counts['declined'];

        return $counts + [
            'acceptance' => $decided ? round($counts['accepted'] / $decided, 3) : null,
            'reasons'    => $reasons,
        ];
    }

    /** @return int[] the drinks, in order */
    private static function ids(array $ideas): array
    {
        $ids = array_column($ideas, 'recipe_id');
        sort($ids);

        return $ids;
    }
}
