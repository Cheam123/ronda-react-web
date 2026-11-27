<?php

namespace App\Http\Controllers;

use App\Models\Cities;
use App\Models\States;
use App\Services\Maps\PlaceSearch;
use Illuminate\Http\Request;

/**
 * The outlet map picker's search, for the web form (session) and the app
 * (Sanctum): the same three calls under both. Each answers response_success
 * with the place, plus the state and city ids it matches in Ronda's lists so
 * the forms can fill those in too.
 */
class PlaceController extends Controller
{
    /** Names Amazon may use for a state => the name in the states table, both normalised. */
    private const STATE_ALIASES = [
        'pulau pinang'   => 'penang',
        'malacca'        => 'melaka',
        'negri sembilan' => 'negeri sembilan',
    ];

    private PlaceSearch $places;

    public function __construct()
    {
        $this->places = PlaceSearch::fromConfig();
    }

    public function suggest(Request $request)
    {
        $data = $request->validate([
            'q'   => 'required|string|max:200',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
        ]);

        $near = isset($data['lat'], $data['lng']);

        return $this->response_success(
            $this->places->suggest($data['q'], $near ? (float) $data['lat'] : null, $near ? (float) $data['lng'] : null)
        );
    }

    public function show(Request $request)
    {
        $data  = $request->validate(['id' => 'required|string|max:2000']);
        $place = $this->places->place($data['id']);

        return $place
            ? $this->response_success($this->withAreaIds($place))
            : $this->response_failed('We could not find that place. Try another search, or move the pin by hand.');
    }

    public function reverse(Request $request)
    {
        $data = $request->validate([
            'lat' => 'required|numeric|between:-90,90',
            'lng' => 'required|numeric|between:-180,180',
        ]);

        $place = $this->places->reverse((float) $data['lat'], (float) $data['lng']);

        // No address is not an error: the pin still counts.
        return $this->response_success($place ? $this->withAreaIds($place) : null);
    }

    /** The place with the ids of its state and city in Ronda's lists, when they match. */
    private function withAreaIds(array $place): array
    {
        $state = $place['state']
            ? States::get(['id', 'name'])->first(fn (States $state) => self::normalise($state->name) === self::normalise($place['state']))
            : null;

        $city = $state && $place['city']
            ? Cities::where('state_id', $state->id)->get(['id', 'name'])
                ->first(fn (Cities $city) => self::normalise($city->name) === self::normalise($place['city']))
            : null;

        return $place + ['state_id' => $state?->id, 'city_id' => $city?->id];
    }

    /** "Wilayah Persekutuan Kuala Lumpur", "WP Kuala Lumpur" and "Kuala Lumpur" all read "kuala lumpur". */
    private static function normalise(?string $name): string
    {
        $name = mb_strtolower(trim((string) $name));
        $name = (string) preg_replace('/^(wilayah persekutuan|federal territory of|w\.?\s?p\.?)\s+/u', '', $name);
        $name = trim((string) preg_replace('/[^a-z0-9]+/u', ' ', $name));

        return self::STATE_ALIASES[$name] ?? $name;
    }
}
