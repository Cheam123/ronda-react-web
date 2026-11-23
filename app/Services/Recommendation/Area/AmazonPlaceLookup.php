<?php

namespace App\Services\Recommendation\Area;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * What is around a pin, from Amazon Location Service's SearchNearby. In the
 * Singapore (ap-southeast-1) and Malaysia (ap-southeast-5) regions its places
 * come from GrabMaps.
 *
 * One request takes at most 10 categories, so they are asked for in GROUPS,
 * each paged up to `max_pages` pages of 100: 4 to 12 requests an outlet. Each
 * place keeps its name and its distance from the pin. The results are stored
 * on the outlet, so every request says IntendedUse = Storage, as Amazon's
 * terms require, and is charged at the Stored price.
 *
 * Returns null when there is no key, or Amazon refuses or can't be reached,
 * so FallbackPlaceLookup can use the seeded list instead. A partial answer is
 * never used: one missing group would skew the area shares.
 */
final class AmazonPlaceLookup implements PlaceLookup
{
    /** Amazon categories asked for together, at most 10 per request. */
    public const GROUPS = [
        // Education, homes, offices and sights.
        ['higher_education', 'student_housing', 'school', 'kindergarten_and_childcare', 'residential_area-building', 'business_facility', 'bank', 'cinema', 'museum', 'tourist_attraction'],
        // Shopping, hotels and gyms.
        ['shopping_mall', 'department_store', 'convenience_store', 'grocery', 'clothing_and_accessories', 'market', 'food_market-stall', 'hotel', 'hotel_or_motel', 'fitness-health_club'],
        // Transport, industry and the outdoors.
        ['train_station', 'underground_train-subway', 'lightrail', 'monorail', 'bus_station', 'manufacturing', 'industrial_zone', 'warehouse', 'park-recreation_area', 'sports_facility-venue'],
        // Food and drink: the competition.
        ['coffee_shop', 'coffee-tea', 'tea_house', 'restaurant', 'fast_food'],
    ];

    /**
     * Amazon category => place category (config ife.recommendation.area.place_categories
     * and competitor_categories). Includes sub-categories a group may answer with.
     */
    public const CATEGORY_MAP = [
        'higher_education'           => 'university',
        'student_housing'            => 'hostel',
        'school'                     => 'school',
        'primary_school'             => 'school',
        'secondary_school'           => 'school',
        'kindergarten_and_childcare' => 'school',
        'residential_area-building'  => 'apartment',
        'business_facility'          => 'office_building',
        'bank'                       => 'bank',
        'cinema'                     => 'cinema',
        'museum'                     => 'attraction',
        'art_museum'                 => 'attraction',
        'history_museum'             => 'attraction',
        'science_museum'             => 'attraction',
        'tourist_attraction'         => 'attraction',
        'landmark-attraction'        => 'attraction',
        'shopping_mall'              => 'mall',
        'department_store'           => 'mall',
        'convenience_store'          => 'shop',
        'grocery'                    => 'shop',
        'clothing_and_accessories'   => 'shop',
        'specialty_clothing_store'   => 'shop',
        'market'                     => 'market',
        'food_market-stall'          => 'market',
        'hotel'                      => 'hotel',
        'hotel_or_motel'             => 'hotel',
        'hostel'                     => 'hotel',
        'lodging'                    => 'hotel',
        'fitness-health_club'        => 'gym',
        'sports_facility-venue'      => 'gym',
        'sports_complex-stadium'     => 'gym',
        'indoor_sports'              => 'gym',
        'train_station'              => 'train_station',
        'underground_train-subway'   => 'train_station',
        'lightrail'                  => 'train_station',
        'monorail'                   => 'train_station',
        'bus_station'                => 'bus_station',
        'bus_rapid_transit'          => 'bus_station',
        'manufacturing'              => 'factory',
        'industrial_zone'            => 'factory',
        'warehouse'                  => 'warehouse',
        'park-recreation_area'       => 'park',
        'coffee_shop'                => 'cafe',
        'coffee-tea'                 => 'cafe',
        'tea_house'                  => 'cafe',
        'restaurant'                 => 'restaurant',
        'fast_food'                  => 'fast_food',
    ];

    private string $endpoint;

    public function __construct(
        private string $key,
        private string $region = 'ap-southeast-1',
        private int $radius = 1000,
        private int $timeout = 20,
        private int $maxPages = 3,
        ?string $endpoint = null,
    ) {
        $this->endpoint = rtrim($endpoint ?: "https://places.geo.{$region}.amazonaws.com/v2", '/');
    }

    /** Whether outlets are looked up live: switched on, and with a key. */
    public static function live(): bool
    {
        return (bool) config('ife.recommendation.area.live.enabled') && self::configured();
    }

    public static function configured(): bool
    {
        return trim((string) config('ife.recommendation.area.amazon.key')) !== '';
    }

    /** Where a live lookup sends outlet coordinates, in words. */
    public static function destination(): string
    {
        return 'Amazon Location Service (' . config('ife.recommendation.area.amazon.region', 'ap-southeast-1') . ')';
    }

    public static function fromConfig(): self
    {
        $amazon = config('ife.recommendation.area.amazon', []);

        return new self(
            (string) ($amazon['key'] ?? ''),
            (string) ($amazon['region'] ?? 'ap-southeast-1'),
            (int) config('ife.recommendation.area.live.radius', 1000),
            (int) ($amazon['timeout'] ?? 20),
            max(1, (int) ($amazon['max_pages'] ?? 3)),
            $amazon['endpoint'] ?? null,
        );
    }

    public function near(float $latitude, float $longitude): ?array
    {
        if (trim($this->key) === '') {
            return null;
        }

        $places = [];
        $seen   = [];

        foreach (self::GROUPS as $categories) {
            $token = null;
            $page  = 0;

            do {
                $answer = $this->search($latitude, $longitude, $categories, $token);
                if ($answer === null) {
                    return null;
                }

                foreach ($answer['ResultItems'] as $item) {
                    $id = $item['PlaceId'] ?? null;
                    if ($id !== null && isset($seen[$id])) {
                        continue;
                    }

                    $category = self::category($item['Categories'] ?? []);
                    if ($category === null) {
                        continue;
                    }
                    if ($id !== null) {
                        $seen[$id] = true;
                    }

                    $name     = trim((string) ($item['Title'] ?? ''));
                    $places[] = [
                        'category' => $category,
                        'name'     => $name !== '' ? $name : null,
                        'distance' => self::distance($item, $latitude, $longitude),
                    ];
                }

                $token = $answer['NextToken'] ?? null;
                $page++;
            } while ($token !== null && $page < $this->maxPages);
        }

        if ($places === []) {
            return null;
        }

        usort($places, fn (array $a, array $b) => ($a['distance'] ?? PHP_INT_MAX) <=> ($b['distance'] ?? PHP_INT_MAX));

        return [
            'name'     => 'Amazon Location Service',
            'district' => null,
            'state'    => null,
            'nearby'   => self::countPlaces($places),
            'places'   => $places,
            'radius'   => $this->radius,
            'source'   => 'amazon',
        ];
    }

    /**
     * The request body for one page of one group.
     *
     * @param string[] $categories
     */
    public function body(float $latitude, float $longitude, array $categories, ?string $token = null): array
    {
        return array_filter([
            'QueryPosition' => [$longitude, $latitude],
            'QueryRadius'   => $this->radius,
            'MaxResults'    => 100,
            'Filter'        => ['IncludeCategories' => array_values($categories)],
            // The results are kept on the outlet, which Amazon's terms only allow at the Stored price.
            'IntendedUse'   => 'Storage',
            'Language'      => 'en',
            'NextToken'     => $token,
        ], fn ($value) => $value !== null);
    }

    /**
     * How many places of each category were found, by category name.
     *
     * @param array<int, array{category: string}> $places
     * @return array<string, int>
     */
    public static function countPlaces(array $places): array
    {
        $counts = [];
        foreach ($places as $place) {
            $counts[$place['category']] = ($counts[$place['category']] ?? 0) + 1;
        }
        ksort($counts);

        return $counts;
    }

    /**
     * The first of a place's categories, primary first, that the area profile knows.
     *
     * @param array<int, array{Id?: string, Primary?: bool}> $categories
     */
    public static function category(array $categories): ?string
    {
        usort($categories, fn (array $a, array $b) => (int) ($b['Primary'] ?? false) <=> (int) ($a['Primary'] ?? false));

        foreach ($categories as $category) {
            $mapped = self::CATEGORY_MAP[$category['Id'] ?? ''] ?? null;
            if ($mapped !== null) {
                return $mapped;
            }
        }

        return null;
    }

    /** @param string[] $categories */
    private function search(float $latitude, float $longitude, array $categories, ?string $token): ?array
    {
        try {
            // Throttled or busy (429, 5xx): one retry after a short wait.
            $response = Http::timeout($this->timeout)
                ->acceptJson()
                ->retry(2, 2000, fn ($exception) => $exception instanceof RequestException
                    && in_array($exception->response->status(), [429, 500, 502, 503, 504], true), throw: false)
                ->post($this->endpoint . '/search-nearby?' . http_build_query(['key' => $this->key]), $this->body($latitude, $longitude, $categories, $token));
        } catch (\Throwable $e) {
            Log::info('Amazon place lookup unavailable; using the seeded list', ['error' => $this->redact($e->getMessage())]);

            return null;
        }

        if (!$response->successful() || !is_array($response->json('ResultItems'))) {
            Log::info('Amazon place lookup failed; using the seeded list', [
                'status'  => $response->status(),
                'message' => $this->redact((string) $response->json('Message')),
            ]);

            return null;
        }

        return $response->json();
    }

    /** Metres from the pin: Amazon's own distance, else worked out from the place's position. */
    private static function distance(array $item, float $latitude, float $longitude): ?int
    {
        if (is_numeric($item['Distance'] ?? null)) {
            return (int) round((float) $item['Distance']);
        }

        [$lng, $lat] = array_pad((array) ($item['Position'] ?? []), 2, null);

        return is_numeric($lat) && is_numeric($lng)
            ? (int) round(SeededPlaceLookup::kilometres($latitude, $longitude, (float) $lat, (float) $lng) * 1000)
            : null;
    }

    /** Keeps the API key out of the log. */
    private function redact(string $text): string
    {
        return $this->key !== '' ? str_replace([$this->key, rawurlencode($this->key)], '[key]', $text) : $text;
    }
}
