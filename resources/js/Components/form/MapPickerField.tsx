import { usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import GpsStampField from '@/Components/form/GpsStampField';
import type { LatLng, PinMap } from '@/lib/amazonMap';
import { captureGpsStamp, mapsUrl, parseGpsStamp, type GpsStamp } from '@/lib/geolocation';
import { errorMessage, getJson } from '@/lib/http';
import type { ApiEnvelope, PageProps } from '@/types';

/** A place as PlaceController answers it. */
export interface MapPlace {
    id: string | null;
    title: string | null;
    address: string | null;
    postcode: string | null;
    state: string | null;
    city: string | null;
    state_id: number | null;
    city_id: number | null;
    lat: number | null;
    lng: number | null;
}

interface Suggestion {
    id: string;
    title: string;
    address: string | null;
}

interface MapPickerFieldProps {
    /** The location as a JSON stamp string ('' when there is none), as GpsStampField keeps it. */
    value: string;
    onChange: (value: string) => void;
    /**
     * The address at the pin. `replace` is false when it was found on its own
     * (fill only what is empty) and true when the rep asked to use it.
     */
    onPlace?: (place: MapPlace, replace: boolean) => void;
}

const WHEN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** A pin the rep placed by hand: no GPS accuracy. */
const placedStamp = (at: LatLng): GpsStamp => ({
    lat: at.lat,
    lng: at.lng,
    accuracy: null,
    captured_at: new Date().toISOString(),
});

/**
 * Where the outlet is, on an Amazon Location map: search for it, click the map
 * or drag the pin, or use this device's location. The address found at the
 * pin fills the form's empty address fields. Without the map key it is the
 * plain Stamp location button.
 */
export default function MapPickerField({ value, onChange, onPlace }: MapPickerFieldProps) {
    const config = usePage<PageProps>().props.app.map;
    const stamp = parseGpsStamp(value);
    const listId = useId();

    const container = useRef<HTMLDivElement>(null);
    const pinMap = useRef<PinMap | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchRun = useRef(0);

    const [found, setFound] = useState<MapPlace | null>(null);
    const [lookingUp, setLookingUp] = useState(false);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    // The map is created once; it reaches the latest callbacks through refs.
    const latest = useRef({ onChange, onPlace });
    latest.current = { onChange, onPlace };

    const lookUpAddress = useCallback(async (at: LatLng) => {
        setLookingUp(true);
        try {
            const body = await getJson<ApiEnvelope<MapPlace | null>>(route('places.reverse'), {
                lat: at.lat,
                lng: at.lng,
            });
            setFound(body.data ?? null);
            if (body.data) latest.current.onPlace?.(body.data, false);
        } catch {
            setFound(null);
        } finally {
            setLookingUp(false);
        }
    }, []);

    const placePin = useCallback(
        (at: LatLng) => {
            latest.current.onChange(JSON.stringify(placedStamp(at)));
            void lookUpAddress(at);
        },
        [lookUpAddress],
    );

    useEffect(() => {
        if (!config || !container.current) return;
        let cancelled = false;
        const initial = parseGpsStamp(value);

        import('@/lib/amazonMap')
            .then(({ createPinMap }) => {
                if (cancelled || !container.current) return;
                pinMap.current = createPinMap(container.current, config, {
                    pin: initial ? { lat: initial.lat, lng: initial.lng } : null,
                    onMove: placePin,
                    cooperative: true,
                    dark: document.documentElement.dataset.theme === 'dark',
                });
            })
            .catch(() => setMapError('The map could not load. Check your connection, or stamp the location instead.'));

        return () => {
            cancelled = true;
            pinMap.current?.destroy();
            pinMap.current = null;
        };
        // Built once per mount; later pins move through pinMap.current.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config?.key]);

    // Type-ahead search, a moment after typing stops.
    useEffect(() => {
        const text = query.trim();
        if (!config?.search || text.length < 2) {
            setSuggestions([]);
            setSearching(false);
            return;
        }

        const run = ++searchRun.current;
        setSearching(true);
        const timer = window.setTimeout(async () => {
            try {
                const near = pinMap.current?.center();
                const body = await getJson<ApiEnvelope<Suggestion[]>>(route('places.suggest'), { q: text, ...near });
                if (run !== searchRun.current) return;
                setSuggestions(body.data ?? []);
                setActive(-1);
                setSearchError(null);
            } catch (error) {
                if (run === searchRun.current) setSearchError(errorMessage(error));
            } finally {
                if (run === searchRun.current) setSearching(false);
            }
        }, 300);

        return () => window.clearTimeout(timer);
    }, [query, config?.search]);

    const choose = async (suggestion: Suggestion) => {
        setOpen(false);
        setQuery(suggestion.title);
        setSearchError(null);
        try {
            const body = await getJson<ApiEnvelope<MapPlace>>(route('places.show'), { id: suggestion.id });
            const place = body.data;
            if (!place || place.lat === null || place.lng === null)
                throw new Error('That place has no position on the map.');
            const at = { lat: place.lat, lng: place.lng };
            pinMap.current?.setPin(at);
            onChange(JSON.stringify(placedStamp(at)));
            setFound(place);
            onPlace?.(place, false);
        } catch (error) {
            setSearchError(errorMessage(error));
        }
    };

    const locateMe = async () => {
        setLocating(true);
        setLocateError(null);
        try {
            const here = await captureGpsStamp();
            pinMap.current?.setPin({ lat: here.lat, lng: here.lng });
            onChange(JSON.stringify(here));
            void lookUpAddress({ lat: here.lat, lng: here.lng });
        } catch (error) {
            setLocateError(error instanceof Error ? error.message : String(error));
        } finally {
            setLocating(false);
        }
    };

    const clear = () => {
        pinMap.current?.clearPin();
        onChange('');
        setFound(null);
    };

    const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && suggestions.length) {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (index + 1) % suggestions.length);
        } else if (event.key === 'ArrowUp' && suggestions.length) {
            event.preventDefault();
            setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
        } else if (event.key === 'Enter') {
            // Never submit the outlet form from the search box.
            event.preventDefault();
            const pick = suggestions[active >= 0 ? active : 0];
            if (pick) void choose(pick);
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    if (!config || mapError) {
        return (
            <div className="map-picker">
                {mapError && <p className="map-picker__note is-error">{mapError}</p>}
                <GpsStampField value={value} onChange={onChange} />
            </div>
        );
    }

    const showList = open && query.trim().length >= 2 && (suggestions.length > 0 || (!searching && !searchError));

    return (
        <div className="map-picker">
            {config.search && (
                <div className="map-picker__search">
                    <i className="mdi mdi-magnify" aria-hidden="true" />
                    <input
                        type="search"
                        className="map-picker__input"
                        placeholder="Search for the outlet or a place near it"
                        aria-label="Search the map"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showList}
                        aria-controls={listId}
                        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                        onKeyDown={onSearchKey}
                    />
                    {searching && <i className="mdi mdi-loading mdi-spin map-picker__spinner" aria-hidden="true" />}
                    {showList && (
                        <ul id={listId} className="map-picker__results" role="listbox">
                            {suggestions.length === 0 ? (
                                <li className="map-picker__empty">
                                    No places found. Try another name, or move the pin by hand.
                                </li>
                            ) : (
                                suggestions.map((suggestion, index) => (
                                    <li
                                        key={suggestion.id}
                                        id={`${listId}-${index}`}
                                        role="option"
                                        aria-selected={index === active}
                                        className={clsx('map-picker__result', index === active && 'is-active')}
                                        // mousedown, not click: it lands before the input's blur closes the list.
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            void choose(suggestion);
                                        }}
                                    >
                                        <span className="map-picker__result-title">{suggestion.title}</span>
                                        {suggestion.address && (
                                            <span className="map-picker__result-address">{suggestion.address}</span>
                                        )}
                                    </li>
                                ))
                            )}
                        </ul>
                    )}
                </div>
            )}
            {searchError && <p className="map-picker__note is-error">{searchError}</p>}

            <div
                ref={container}
                className="map-picker__map"
                role="application"
                aria-label="Map of the outlet. Click to place the pin, or drag it."
            />

            <div className="map-picker__bar">
                <span className="map-picker__status">
                    {stamp ? (
                        <>
                            <span className="map-picker__coords">
                                {stamp.lat.toFixed(6)}, {stamp.lng.toFixed(6)}
                            </span>
                            <span className="map-picker__meta">
                                {typeof stamp.accuracy === 'number'
                                    ? `Your location, ±${Math.round(stamp.accuracy)} m`
                                    : 'Placed on the map'}
                                {stamp.captured_at && ` · ${WHEN.format(new Date(stamp.captured_at))}`}
                                {' · '}
                                <a href={mapsUrl(stamp)} target="_blank" rel="noopener noreferrer">
                                    Open in Maps
                                </a>
                            </span>
                        </>
                    ) : (
                        <span className="map-picker__meta">
                            No pin yet. Search, click the map, or use your location at the outlet.
                        </span>
                    )}
                </span>
                <button type="button" className="rd-btn" onClick={locateMe} disabled={locating}>
                    <i
                        className={clsx('mdi', locating ? 'mdi-loading mdi-spin' : 'mdi-crosshairs-gps')}
                        aria-hidden="true"
                    />
                    Use my location
                </button>
                {stamp && (
                    <button type="button" className="rd-btn rd-btn--quiet" onClick={clear}>
                        Clear
                    </button>
                )}
            </div>
            {locateError && <p className="map-picker__note is-error">{locateError}</p>}

            {(lookingUp || found?.address) && (
                <p className="map-picker__found" aria-live="polite">
                    {lookingUp ? (
                        'Looking up the address…'
                    ) : (
                        <>
                            <span>
                                <span className="map-picker__found-label">Address at the pin:</span> {found?.address}
                            </span>
                            {onPlace && found && (
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--sm rd-btn--quiet"
                                    onClick={() => onPlace(found, true)}
                                >
                                    Use this address
                                </button>
                            )}
                        </>
                    )}
                </p>
            )}
        </div>
    );
}
