<?php

namespace App\Services\Recommendation\Area;

/**
 * Tries the live lookup first and uses the seeded list when it has nothing,
 * for example offline during the viva.
 */
final class FallbackPlaceLookup implements PlaceLookup
{
    public function __construct(private PlaceLookup $primary, private PlaceLookup $fallback)
    {
    }

    public function near(float $latitude, float $longitude): ?array
    {
        return $this->primary->near($latitude, $longitude) ?? $this->fallback->near($latitude, $longitude);
    }
}
