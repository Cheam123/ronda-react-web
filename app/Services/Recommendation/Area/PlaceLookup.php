<?php

namespace App\Services\Recommendation\Area;

/**
 * Finds what is around a map pin: live from Amazon Location Service
 * (AmazonPlaceLookup) or from the seeded list (SeededPlaceLookup), which needs
 * no network.
 */
interface PlaceLookup
{
    /**
     * nearby counts places by category. A live answer also lists each place
     * with its distance (places) and the radius it searched; a seeded one doesn't.
     *
     * @return array{name: string, nearby: array<string, int>, places?: array<int, array{category: string, name: ?string, distance: ?int}>, radius?: int, source?: string}|null null when nothing is known about the pin
     */
    public function near(float $latitude, float $longitude): ?array;
}
