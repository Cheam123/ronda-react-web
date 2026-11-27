<?php

namespace Tests\Feature;

use App\Services\Recommendation\Area\AmazonPlaceLookup;
use App\Services\Recommendation\Area\AreaProfiler;
use App\Services\Recommendation\Area\FallbackPlaceLookup;
use App\Services\Recommendation\Area\PlaceLookup;
use App\Services\Recommendation\Area\SeededPlaceLookup;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/** Nearby places from Amazon Location Service (GrabMaps in Malaysia). No real call to AWS. */
class AmazonPlaceLookupTest extends TestCase
{
    private const KEY = 'test-key-123';

    private function lookup(int $maxPages = 3): AmazonPlaceLookup
    {
        return new AmazonPlaceLookup(self::KEY, 'ap-southeast-1', 1000, 5, $maxPages);
    }

    private static function item(string $id, string $title, int $distance, array $categories): array
    {
        return [
            'PlaceId'    => $id,
            'Title'      => $title,
            'Distance'   => $distance,
            'Categories' => array_map(fn ($category, $index) => ['Id' => $category, 'Primary' => $index === 0], $categories, array_keys($categories)),
        ];
    }

    /** A fake Amazon that answers each group of categories with its own places. */
    private function fakeAmazon(array $byFirstCategory): void
    {
        Http::fake(function (Request $request) use ($byFirstCategory) {
            $first = $request->data()['Filter']['IncludeCategories'][0] ?? null;

            return Http::response(['ResultItems' => $byFirstCategory[$first] ?? []]);
        });
    }

    public function test_every_group_fits_one_request_and_every_category_is_known(): void
    {
        $known = array_merge(array_keys(config('ife.recommendation.area.place_categories')), config('ife.recommendation.area.competitor_categories'));

        foreach (AmazonPlaceLookup::GROUPS as $group) {
            $this->assertLessThanOrEqual(10, count($group), 'Amazon takes at most 10 categories a request');
            foreach ($group as $category) {
                $this->assertArrayHasKey($category, AmazonPlaceLookup::CATEGORY_MAP, $category);
            }
        }
        foreach (AmazonPlaceLookup::CATEGORY_MAP as $amazon => $ours) {
            $this->assertContains($ours, $known, "{$amazon} maps to an unknown place category");
        }
    }

    public function test_each_group_is_asked_once_with_the_key_the_radius_and_storage(): void
    {
        $this->fakeAmazon(['higher_education' => [self::item('p1', 'A University', 400, ['higher_education'])]]);

        $this->lookup()->near(3.0, 101.7);

        Http::assertSentCount(count(AmazonPlaceLookup::GROUPS));
        Http::assertSent(function (Request $request) {
            $body = $request->data();

            return str_starts_with($request->url(), 'https://places.geo.ap-southeast-1.amazonaws.com/v2/search-nearby?key=' . self::KEY)
                && $body['QueryPosition'] === [101.7, 3.0]
                && $body['QueryRadius'] === 1000
                && $body['MaxResults'] === 100
                && $body['IntendedUse'] === 'Storage'
                && count($body['Filter']['IncludeCategories']) <= 10
                && !isset($body['NextToken']);
        });
    }

    public function test_places_are_mapped_primary_first_deduplicated_and_nearest_first(): void
    {
        $this->fakeAmazon([
            'higher_education' => [
                self::item('p1', 'A University', 400, ['higher_education']),
                self::item('p2', 'Block A', 250, ['residential_area-building']),
                self::item('p3', 'A Dentist', 50, ['dentist-dental_office']), // not a kind the profile knows
            ],
            'shopping_mall' => [
                self::item('p4', 'A Mall', 800, ['shopping_mall']),
                self::item('p2', 'Block A', 250, ['residential_area-building']), // already found
                ['PlaceId' => 'p5', 'Title' => 'A Hotel', 'Position' => [101.7, 3.0018], 'Categories' => [['Id' => 'hotel', 'Primary' => true]]],
            ],
            'coffee_shop' => [
                ['PlaceId' => 'p6', 'Title' => 'Kopi Corner', 'Distance' => 35, 'Categories' => [['Id' => 'restaurant', 'Primary' => false], ['Id' => 'coffee_shop', 'Primary' => true]]],
            ],
        ]);

        $answer = $this->lookup()->near(3.0, 101.7);

        $this->assertSame('amazon', $answer['source']);
        $this->assertSame(1000, $answer['radius']);
        $this->assertSame(['cafe', 'hotel', 'apartment', 'university', 'mall'], array_column($answer['places'], 'category'));
        $this->assertSame('Kopi Corner', $answer['places'][0]['name']);
        $this->assertEqualsWithDelta(200, $answer['places'][1]['distance'], 2, 'No distance given, so worked out from the position');
        $this->assertSame(['apartment' => 1, 'cafe' => 1, 'hotel' => 1, 'mall' => 1, 'university' => 1], $answer['nearby']);
    }

    public function test_pages_are_followed_up_to_the_limit(): void
    {
        Http::fake(function (Request $request) {
            $body = $request->data();
            if (($body['Filter']['IncludeCategories'][0] ?? null) !== 'coffee_shop') {
                return Http::response(['ResultItems' => []]);
            }
            $page = (int) ($body['NextToken'] ?? 0);

            return Http::response([
                'ResultItems' => [self::item("c{$page}", "Cafe {$page}", 100 + $page, ['coffee_shop'])],
                'NextToken'   => (string) ($page + 1),
            ]);
        });

        $answer = $this->lookup(maxPages: 2)->near(3.0, 101.7);

        $this->assertSame(['cafe' => 2], $answer['nearby'], 'Two pages, then it stops');
        Http::assertSent(fn (Request $request) => ($request->data()['NextToken'] ?? null) === '1');
        Http::assertNotSent(fn (Request $request) => ($request->data()['NextToken'] ?? null) === '2');
    }

    public function test_one_refused_group_means_no_answer_so_the_seeded_list_answers(): void
    {
        Http::fake(function (Request $request) {
            return ($request->data()['Filter']['IncludeCategories'][0] ?? null) === 'train_station'
                ? Http::response(['Message' => 'Forbidden'], 403)
                : Http::response(['ResultItems' => [self::item('p1', 'A Mall', 300, ['shopping_mall'])]]);
        });

        $this->assertNull($this->lookup()->near(3.1579, 101.7123), 'A partial answer would skew the shares');

        $seeded = new SeededPlaceLookup();
        $this->assertSame($seeded->near(3.1579, 101.7123), (new FallbackPlaceLookup($this->lookup(), $seeded))->near(3.1579, 101.7123));
    }

    public function test_the_key_never_reaches_the_log(): void
    {
        Log::spy();
        Http::fake(fn () => throw new ConnectionException('cURL error 28 for https://places.geo.ap-southeast-1.amazonaws.com/v2/search-nearby?key=' . self::KEY));

        $this->assertNull($this->lookup()->near(3.0, 101.7));

        Log::shouldHaveReceived('info')->withArgs(fn (string $message, array $context) => !str_contains(json_encode($context), self::KEY))->once();
    }

    public function test_without_a_key_nothing_is_sent(): void
    {
        Http::fake();

        $this->assertNull((new AmazonPlaceLookup(''))->near(3.0, 101.7));
        Http::assertNothingSent();
    }

    public function test_a_profile_from_amazon_weighs_by_distance_and_keeps_its_source(): void
    {
        $this->fakeAmazon([
            'higher_education' => [self::item('p1', 'A University', 200, ['higher_education'])],
            'train_station'    => [self::item('p2', 'A Station', 900, ['train_station'])],
            'coffee_shop'      => [self::item('p3', 'Kopi Corner', 60, ['coffee_shop'])],
        ]);

        $profiler = new AreaProfiler($this->lookup(), config('ife.recommendation.area'));
        $profile  = $profiler->profile(['latitude' => 3.0, 'longitude' => 101.7]);

        $this->assertSame('amazon', $profile['area_source']);
        $this->assertTrue($profile['area_details']['weighted']);
        $this->assertSame(['university', 'transit'], array_keys($profile['area_details']['scores']));
        $this->assertSame(['count' => 1, 'nearest' => 60], $profile['area_details']['competitors']);

        // Profiled again offline, the saved places keep saying where they came from.
        $again = (new AreaProfiler(new SeededPlaceLookup(), config('ife.recommendation.area')))
            ->profile(['nearby_counts' => $profile['nearby_counts'], 'area_source' => 'amazon', 'area_details' => $profile['area_details']]);
        $this->assertSame('amazon', $again['area_source']);
    }

    public function test_the_app_looks_up_live_only_when_switched_on_and_given_a_key(): void
    {
        $this->assertInstanceOf(SeededPlaceLookup::class, app(PlaceLookup::class), 'Off by default in tests');

        config(['ife.recommendation.area.live.enabled' => true, 'ife.recommendation.area.amazon.key' => '']);
        $this->assertInstanceOf(SeededPlaceLookup::class, app(PlaceLookup::class), 'No key: nothing goes anywhere');

        config(['ife.recommendation.area.amazon.key' => self::KEY]);
        $this->assertInstanceOf(FallbackPlaceLookup::class, app(PlaceLookup::class));
        $this->assertSame('Amazon Location Service (ap-southeast-1)', AmazonPlaceLookup::destination());

        config(['ife.recommendation.area.live.enabled' => false]);
        $this->assertInstanceOf(SeededPlaceLookup::class, app(PlaceLookup::class), 'Switched off, even with a key');
    }

    public function test_a_saved_source_other_than_amazon_counts_as_seeded(): void
    {
        $profile = (new AreaProfiler(new SeededPlaceLookup(), config('ife.recommendation.area')))
            ->profile(['nearby_counts' => ['office_building' => 3], 'area_source' => 'osm']);

        $this->assertSame('seeded', $profile['area_source']);
    }

    public function test_the_command_refuses_amazon_without_a_key(): void
    {
        config(['ife.recommendation.area.amazon.key' => '']);

        $this->artisan('area:profile', ['--live' => true])
            ->expectsOutputToContain('AREA_AMAZON_KEY')
            ->assertExitCode(2);
    }
}
