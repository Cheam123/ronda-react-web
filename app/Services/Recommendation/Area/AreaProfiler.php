<?php

namespace App\Services\Recommendation\Area;

/**
 * Works out what is known about where an outlet trades:
 * pin -> nearby places -> weighted area scores -> area types.
 *
 * Each nearby place counts e^(-distance / decay_metres), so a university
 * 200 m away weighs more than one at the edge of the radius. Seeded places
 * have no distance and count 1 each. The weights are summed by area type and
 * turned into shares; a type with at least present_share is Present, from
 * some_share Some presence. Food and drink places are competition: counted,
 * but left out of the shares.
 *
 * A pin with no places found, or no pin at all, simply has no area profile,
 * and the ranking leaves the area out.
 *
 * Pure PHP: the place lookup is passed in, so the rules can be tested without
 * a database or a network.
 */
final class AreaProfiler
{
    /**
     * @param array{present_share: float, some_share: float, decay_metres: int|float, places_kept?: int, place_categories: array<string, string>, competitor_categories?: string[]} $config
     */
    public function __construct(
        private PlaceLookup $places,
        private array $config,
    ) {
    }

    /**
     * @param array{latitude?: mixed, longitude?: mixed, nearby_counts?: ?array, area_source?: ?string, area_details?: ?array} $outlet
     *        nearby_counts already on the outlet (an earlier lookup's) are kept, with their area_source and area_details
     * @return array{area_types: ?array, nearby_counts: ?array, area_source: string, area_details: ?array}
     */
    public function profile(array $outlet): array
    {
        $nearby  = $outlet['nearby_counts'] ?? null;
        $source  = !empty($nearby) && ($outlet['area_source'] ?? null) === 'amazon' ? 'amazon' : 'seeded';
        $details = null;

        if (!empty($nearby)) {
            // Kept counts keep their scores: the full list of places behind them isn't stored.
            $kept    = $outlet['area_details'] ?? null;
            $details = is_array($kept) && isset($kept['scores']) ? $kept : $this->details($nearby);
        } elseif (is_numeric($outlet['latitude'] ?? null) && is_numeric($outlet['longitude'] ?? null)) {
            $place = $this->places->near((float) $outlet['latitude'], (float) $outlet['longitude']);
            if ($place !== null) {
                $nearby  = $place['nearby'];
                $source  = $place['source'] ?? 'seeded';
                $details = $this->details($place['nearby'], $place['places'] ?? null, $place['radius'] ?? null);
            }
        }

        $types = $details === null ? [] : $this->presentTypes($details['scores']);

        return [
            'area_types'    => $types ?: null,
            'nearby_counts' => $nearby ?: null,
            'area_source'   => !empty($nearby) ? $source : 'none',
            'area_details'  => $details,
        ];
    }

    /**
     * The weighted area scores behind a profile, and the evidence for each.
     *
     * @param array<string, int|float> $nearby place category => count
     * @param array<int, array{category: string, name: ?string, distance: ?int}>|null $places each place with its distance, when known
     * @return array{radius: ?int, weighted: bool, scores: array<string, float>, evidence: array<string, array{count: int, nearest: ?int}>, competitors: array{count: int, nearest: ?int}, places: array<int, array{category: string, name: ?string, distance: ?int, kind: ?string}>}
     */
    public function details(array $nearby, ?array $places = null, ?int $radius = null): array
    {
        $kinds       = $this->config['place_categories'];
        $competitors = $this->config['competitor_categories'] ?? [];
        $decay       = max(1.0, (float) ($this->config['decay_metres'] ?? 500));
        $weighted    = !empty($places) && !in_array(null, array_column($places, 'distance'), true);

        $weights  = [];
        $evidence = [];
        $rivals   = ['count' => 0, 'nearest' => null];

        foreach ($nearby as $category => $count) {
            if ($count <= 0) {
                continue;
            }
            if (in_array($category, $competitors, true)) {
                $rivals['count'] += (int) $count;
                continue;
            }
            $kind = $kinds[$category] ?? null;
            if ($kind === null) {
                continue;
            }
            $evidence[$kind] = ['count' => ($evidence[$kind]['count'] ?? 0) + (int) $count, 'nearest' => null];
            if (!$weighted) {
                $weights[$kind] = ($weights[$kind] ?? 0.0) + (float) $count;
            }
        }

        if ($weighted) {
            foreach ($places as $place) {
                $distance = (int) $place['distance'];
                if (in_array($place['category'], $competitors, true)) {
                    $rivals['nearest'] = min($rivals['nearest'] ?? PHP_INT_MAX, $distance);
                    continue;
                }
                $kind = $kinds[$place['category']] ?? null;
                if ($kind === null || !isset($evidence[$kind])) {
                    continue;
                }
                $weights[$kind]             = ($weights[$kind] ?? 0.0) + exp(-$distance / $decay);
                $evidence[$kind]['nearest'] = min($evidence[$kind]['nearest'] ?? PHP_INT_MAX, $distance);
            }
        }

        $total  = array_sum($weights);
        $scores = [];
        foreach ($weights as $kind => $weight) {
            $scores[$kind] = $total > 0 ? round($weight / $total, 3) : 0.0;
        }
        // Biggest share first; the same share goes by name.
        uksort($scores, fn (string $a, string $b) => [$scores[$b], $a] <=> [$scores[$a], $b]);
        ksort($evidence);

        $kept = array_map(
            fn (array $place) => [
                'category' => $place['category'],
                'name'     => $place['name'] ?? null,
                'distance' => $place['distance'] ?? null,
                'kind'     => $kinds[$place['category']] ?? null,
            ],
            array_slice($places ?? [], 0, (int) ($this->config['places_kept'] ?? 30))
        );

        return [
            'radius'      => $radius,
            'weighted'    => $weighted,
            'scores'      => $scores,
            'evidence'    => $evidence,
            'competitors' => $rivals,
            'places'      => $kept,
        ];
    }

    /**
     * Area types with at least present_share of the weighted places.
     *
     * @param array<string, float> $scores area type => share
     * @return string[] sorted
     */
    public function presentTypes(array $scores): array
    {
        $types = array_keys(array_filter($scores, fn (float $share) => self::level($share, $this->config) === 'present'));
        sort($types);

        return $types;
    }

    /**
     * How strongly an area type shows around an outlet: 'present', 'some', or null when it barely does.
     *
     * @param array{present_share?: float, some_share?: float} $config
     */
    public static function level(float $share, array $config): ?string
    {
        return match (true) {
            $share >= (float) ($config['present_share'] ?? 0.25) => 'present',
            $share >= (float) ($config['some_share'] ?? 0.10)    => 'some',
            default                                              => null,
        };
    }
}
