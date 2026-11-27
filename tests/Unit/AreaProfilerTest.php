<?php

namespace Tests\Unit;

use App\Services\Recommendation\Area\AreaProfiler;
use App\Services\Recommendation\Area\PlaceLookup;
use App\Services\Recommendation\Area\SeededPlaceLookup;
use PHPUnit\Framework\TestCase;

class AreaProfilerTest extends TestCase
{
    private const CONFIG = [
        'present_share'         => 0.25,
        'some_share'            => 0.10,
        'decay_metres'          => 500,
        'places_kept'           => 3,
        'place_categories'      => ['apartment' => 'residential', 'school' => 'residential', 'office_building' => 'office', 'shop' => 'retail', 'university' => 'university'],
        'competitor_categories' => ['cafe', 'restaurant'],
    ];

    private function profiler(?array $place = null): AreaProfiler
    {
        $lookup = new class ($place) implements PlaceLookup {
            public function __construct(private ?array $place)
            {
            }

            public function near(float $latitude, float $longitude): ?array
            {
                return $this->place;
            }
        };

        return new AreaProfiler($lookup, self::CONFIG);
    }

    public function test_a_seeded_pin_gets_places_and_area_types(): void
    {
        $profile = $this->profiler(['name' => 'X', 'nearby' => ['apartment' => 6, 'school' => 2, 'office_building' => 2]])
            ->profile(['latitude' => 2.9, 'longitude' => 101.6]);

        $this->assertSame(['residential'], $profile['area_types']); // office is 20%, under the share
        $this->assertSame('seeded', $profile['area_source']);
    }

    public function test_a_pin_with_no_places_found_has_an_empty_profile(): void
    {
        $profile = $this->profiler(null)->profile(['latitude' => 5.4, 'longitude' => 100.3]);

        $this->assertSame(
            ['area_types' => null, 'nearby_counts' => null, 'area_source' => 'none', 'area_details' => null],
            $profile
        );
    }

    public function test_with_no_pin_the_profile_is_empty_rather_than_an_error(): void
    {
        $profile = $this->profiler(['name' => 'X', 'nearby' => ['shop' => 9]])->profile(['latitude' => null, 'longitude' => null]);

        $this->assertSame('none', $profile['area_source']);
        $this->assertNull($profile['area_details']);
    }

    public function test_closer_places_count_more(): void
    {
        // One university 200 m away against three apartment blocks 900 m away.
        // By plain counts residential would have 75%; by distance the university leads.
        $profile = $this->profiler([
            'name' => 'Amazon Location Service', 'source' => 'amazon', 'radius' => 1000,
            'nearby' => ['apartment' => 3, 'university' => 1],
            'places' => [
                ['category' => 'university', 'name' => 'A university', 'distance' => 200],
                ['category' => 'apartment', 'name' => null, 'distance' => 900],
                ['category' => 'apartment', 'name' => null, 'distance' => 900],
                ['category' => 'apartment', 'name' => null, 'distance' => 900],
            ],
        ])->profile(['latitude' => 3.07, 'longitude' => 101.79]);

        $details = $profile['area_details'];
        $this->assertTrue($details['weighted']);
        $this->assertSame(['university' => 0.575, 'residential' => 0.425], $details['scores']);
        $this->assertSame(['count' => 1, 'nearest' => 200], $details['evidence']['university']);
        $this->assertSame(['count' => 3, 'nearest' => 900], $details['evidence']['residential']);
        $this->assertSame(['residential', 'university'], $profile['area_types']);
        $this->assertSame(1000, $details['radius']);
        $this->assertSame('amazon', $profile['area_source']);
    }

    public function test_some_presence_and_competition_are_kept_apart(): void
    {
        $profile = $this->profiler(['name' => 'X', 'nearby' => ['apartment' => 7, 'office_building' => 2, 'shop' => 1, 'cafe' => 5]])
            ->profile(['latitude' => 2.9, 'longitude' => 101.6]);

        $details = $profile['area_details'];
        $this->assertFalse($details['weighted'], 'Seeded places have no distances');
        $this->assertSame(['residential' => 0.7, 'office' => 0.2, 'retail' => 0.1], $details['scores'], 'Cafes are not an area type');
        $this->assertSame(['count' => 5, 'nearest' => null], $details['competitors']);
        $this->assertSame(['residential'], $profile['area_types'], 'Only Present types');
        $this->assertSame('some', AreaProfiler::level($details['scores']['office'], self::CONFIG));
        $this->assertSame('some', AreaProfiler::level($details['scores']['retail'], self::CONFIG));
    }

    public function test_levels_follow_the_shares(): void
    {
        $this->assertSame('present', AreaProfiler::level(0.25, self::CONFIG));
        $this->assertSame('some', AreaProfiler::level(0.10, self::CONFIG));
        $this->assertNull(AreaProfiler::level(0.099, self::CONFIG));
    }

    public function test_the_nearest_places_are_kept_with_their_area_type(): void
    {
        $profile = $this->profiler([
            'name' => 'Amazon Location Service', 'source' => 'amazon', 'radius' => 1000,
            'nearby' => ['cafe' => 1, 'shop' => 2, 'apartment' => 1],
            'places' => [
                ['category' => 'cafe', 'name' => 'Kopi Corner', 'distance' => 40],
                ['category' => 'shop', 'name' => null, 'distance' => 120],
                ['category' => 'apartment', 'name' => 'Block A', 'distance' => 300],
                ['category' => 'shop', 'name' => null, 'distance' => 800],
            ],
        ])->profile(['latitude' => 3.07, 'longitude' => 101.79]);

        $places = $profile['area_details']['places'];
        $this->assertCount(3, $places, 'places_kept is 3');
        $this->assertSame(['category' => 'cafe', 'name' => 'Kopi Corner', 'distance' => 40, 'kind' => null], $places[0]);
        $this->assertSame('retail', $places[1]['kind']);
        $this->assertSame(['count' => 1, 'nearest' => 40], $profile['area_details']['competitors']);
    }

    public function test_kept_counts_keep_their_saved_scores(): void
    {
        $saved = ['radius' => 1000, 'weighted' => true, 'scores' => ['university' => 0.6, 'office' => 0.4], 'evidence' => [], 'competitors' => ['count' => 0, 'nearest' => null], 'places' => []];

        $profile = $this->profiler(null)->profile(['nearby_counts' => ['office_building' => 9, 'university' => 1], 'area_source' => 'amazon', 'area_details' => $saved]);

        $this->assertSame($saved, $profile['area_details']);
        $this->assertSame(['office', 'university'], $profile['area_types']);
    }

    public function test_counts_already_on_the_outlet_are_kept(): void
    {
        $profile = $this->profiler(['name' => 'X', 'nearby' => ['shop' => 9]])
            ->profile(['latitude' => 2.9, 'longitude' => 101.6, 'nearby_counts' => ['office_building' => 5]]);

        $this->assertSame(['office'], $profile['area_types']);
    }

    public function test_seeded_lookup_only_answers_near_a_neighbourhood(): void
    {
        $lookup = new SeededPlaceLookup([
            ['name' => 'Bangsar', 'lat' => 3.13, 'lng' => 101.67, 'nearby' => ['shop' => 5]],
        ]);

        $this->assertSame('Bangsar', $lookup->near(3.131, 101.671)['name']);
        $this->assertNull($lookup->near(5.41, 100.33), 'Penang is not seeded');
    }
}
