<?php

namespace App\Services\Recommendation\Area;

/**
 * Nearby places from database/data/seeded_places.json: the closest seeded
 * neighbourhood within MAX_KM of the pin. Further away it knows nothing, and
 * the outlet has no area profile.
 */
final class SeededPlaceLookup implements PlaceLookup
{
    private const MAX_KM = 3.0;

    /** @var array<int, array> */
    private array $neighbourhoods;

    public function __construct(?array $neighbourhoods = null)
    {
        $this->neighbourhoods = $neighbourhoods ?? self::load();
    }

    /** @return array<int, array> */
    public static function load(): array
    {
        $path = database_path('data/seeded_places.json');

        return json_decode((string) file_get_contents($path), true)['neighbourhoods'] ?? [];
    }

    public function near(float $latitude, float $longitude): ?array
    {
        $best     = null;
        $bestDist = self::MAX_KM;

        foreach ($this->neighbourhoods as $place) {
            $distance = self::kilometres($latitude, $longitude, (float) $place['lat'], (float) $place['lng']);
            if ($distance <= $bestDist) {
                $best     = $place;
                $bestDist = $distance;
            }
        }

        if ($best === null) {
            return null;
        }

        return [
            'name'   => $best['name'],
            'nearby' => $best['nearby'],
        ];
    }

    /** Great-circle distance. */
    public static function kilometres(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a    = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 6371.0 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
