<?php

namespace App\Services\Maps;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Finding an outlet on the map, through Amazon Location Service's Places API
 * (v2) with the server's key: the browser and the app ask Ronda, never Amazon,
 * so the key stays here.
 *
 * - suggest(): type-ahead results while the rep types. They are shown and
 *   thrown away, so they are billed at the Label price.
 * - place(): the result the rep picks; reverse(): the address where they put
 *   the pin. Both are saved on the outlet, which Amazon's terms only allow at
 *   the Stored price, so they say IntendedUse = Storage.
 *
 * Every call answers null (or []) when there is no key or Amazon can't be
 * reached: the rep can still place the pin by hand.
 */
final class PlaceSearch
{
    private string $endpoint;

    public function __construct(
        private string $key,
        string $region = 'ap-southeast-1',
        private string $country = 'MYS',
        private int $timeout = 10,
        private array $center = [101.6869, 3.1390],
    ) {
        $this->endpoint = "https://places.geo.{$region}.amazonaws.com/v2";
    }

    public static function fromConfig(): self
    {
        $maps = config('ife.maps', []);

        return new self(
            (string) ($maps['places_key'] ?? ''),
            (string) ($maps['region'] ?? 'ap-southeast-1'),
            (string) ($maps['country'] ?? 'MYS'),
            (int) ($maps['timeout'] ?? 10),
            $maps['center'] ?? [101.6869, 3.1390],
        );
    }

    public function configured(): bool
    {
        return trim($this->key) !== '';
    }

    /**
     * What the map needs in the browser and the app's map page, or null when
     * the map isn't set up (no map key).
     *
     * @return array{key: string, region: string, style: string, center: array{0: float, 1: float}, search: bool}|null
     */
    public static function mapConfig(): ?array
    {
        $maps = config('ife.maps', []);
        $key  = trim((string) ($maps['map_key'] ?? ''));
        if ($key === '') {
            return null;
        }

        return [
            'key'    => $key,
            'region' => (string) ($maps['region'] ?? 'ap-southeast-1'),
            'style'  => (string) ($maps['style'] ?? 'Standard'),
            'center' => array_map('floatval', array_values($maps['center'] ?? [101.6869, 3.1390])),
            'search' => trim((string) ($maps['places_key'] ?? '')) !== '',
        ];
    }

    /**
     * Places matching what the rep typed, nearest the map first.
     *
     * @return array<int, array{id: string, title: string, address: ?string}>
     */
    public function suggest(string $query, ?float $lat = null, ?float $lng = null): array
    {
        $query = trim($query);
        if (!$this->configured() || mb_strlen($query) < 2) {
            return [];
        }

        $near   = $lat !== null && $lng !== null ? [$lng, $lat] : $this->center;
        $answer = $this->call('post', '/suggest', [
            'QueryText'    => mb_substr($query, 0, 200),
            'BiasPosition' => [(float) $near[0], (float) $near[1]],
            'Filter'       => ['IncludeCountries' => [$this->country]],
            'MaxResults'   => 6,
            'Language'     => 'en',
        ]);

        $places = [];
        foreach ($answer['ResultItems'] ?? [] as $item) {
            $id = $item['Place']['PlaceId'] ?? null;
            // A "Query" result is a search phrase, not a place to pin.
            if (($item['SuggestResultItemType'] ?? null) !== 'Place' || !is_string($id) || $id === '') {
                continue;
            }
            $places[] = [
                'id'      => $id,
                'title'   => (string) ($item['Title'] ?? ''),
                'address' => self::withoutCountry($item['Place']['Address']['Label'] ?? null),
            ];
        }

        return $places;
    }

    /** The place the rep picked from the suggestions, with its position and address. */
    public function place(string $id): ?array
    {
        if (!$this->configured() || trim($id) === '') {
            return null;
        }

        $answer = $this->call('get', '/place/' . rawurlencode($id), query: ['intended-use' => 'Storage', 'language' => 'en']);

        return $answer !== null && isset($answer['Position']) ? self::normalise($answer) : null;
    }

    /** The address at a pin. */
    public function reverse(float $lat, float $lng): ?array
    {
        if (!$this->configured()) {
            return null;
        }

        $answer = $this->call('post', '/reverse-geocode', [
            'QueryPosition' => [$lng, $lat],
            'MaxResults'    => 1,
            'IntendedUse'   => 'Storage',
            'Language'      => 'en',
        ]);
        $item = $answer['ResultItems'][0] ?? null;

        return is_array($item) ? self::normalise($item) : null;
    }

    /**
     * A place as the forms use it.
     *
     * @return array{id: ?string, title: ?string, address: ?string, postcode: ?string, state: ?string, city: ?string, lat: ?float, lng: ?float}
     */
    public static function normalise(array $item): array
    {
        $address  = $item['Address'] ?? [];
        $position = $item['Position'] ?? null;
        $hasPoint = is_array($position) && is_numeric($position[0] ?? null) && is_numeric($position[1] ?? null);

        return [
            'id'       => $item['PlaceId'] ?? null,
            'title'    => $item['Title'] ?? null,
            'address'  => self::withoutCountry($address['Label'] ?? null),
            'postcode' => $address['PostalCode'] ?? null,
            'state'    => $address['Region']['Name'] ?? null,
            'city'     => $address['Locality'] ?? ($address['SubRegion']['Name'] ?? null),
            // Amazon answers [longitude, latitude].
            'lat'      => $hasPoint ? round((float) $position[1], 6) : null,
            'lng'      => $hasPoint ? round((float) $position[0], 6) : null,
        ];
    }

    /** "12 Jalan SS 2/24, 47300 Petaling Jaya, Selangor, Malaysia" without ", Malaysia". */
    public static function withoutCountry(?string $label): ?string
    {
        if ($label === null || trim($label) === '') {
            return null;
        }

        return trim((string) preg_replace('/,\s*Malaysia\s*$/i', '', $label));
    }

    private function call(string $method, string $path, array $body = [], array $query = []): ?array
    {
        $url = $this->endpoint . $path . '?' . http_build_query(['key' => $this->key] + $query);

        try {
            $request  = Http::timeout($this->timeout)->acceptJson();
            $response = $method === 'get' ? $request->get($url) : $request->post($url, $body);
        } catch (\Throwable $e) {
            Log::warning('Amazon Location place search failed', ['path' => strtok($path, '?'), 'error' => $e->getMessage()]);

            return null;
        }

        if (!$response->successful()) {
            Log::warning('Amazon Location place search refused', [
                'path'   => $path === '/suggest' || $path === '/reverse-geocode' ? $path : '/place',
                'status' => $response->status(),
                'body'   => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $json = $response->json();

        return is_array($json) ? $json : null;
    }
}
