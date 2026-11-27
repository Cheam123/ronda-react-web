import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapConfig } from '@/types';

export type { MapConfig };

/**
 * The outlet map: Amazon Location Service's map style drawn by MapLibre, with
 * one draggable pin. Loaded lazily (it is large), by MapPickerField on the web
 * and by map-frame.ts for the phone app's map picker.
 */

// MapLibre finds its worker relative to its own file, which a bundle moves.
setWorkerUrl(workerUrl);

export interface LatLng {
    lat: number;
    lng: number;
}

export interface PinMap {
    /** Puts the pin there; `fly` also moves the map to it. */
    setPin(at: LatLng, fly?: boolean): void;
    clearPin(): void;
    /** Where the map is looking, to search near it. */
    center(): LatLng;
    destroy(): void;
}

interface PinMapOptions {
    pin: LatLng | null;
    /** The rep dragged the pin or tapped the map. */
    onMove: (at: LatLng) => void;
    /** Scroll-wheel zoom only with Ctrl/⌘, so a long form still scrolls past the map. */
    cooperative?: boolean;
    dark?: boolean;
}

const PIN_ZOOM = 17;
const AREA_ZOOM = 11;

export function styleUrl(config: MapConfig, dark = false): string {
    const params = new URLSearchParams({ key: config.key, 'color-scheme': dark ? 'Dark' : 'Light' });
    return `https://maps.geo.${config.region}.amazonaws.com/v2/styles/${encodeURIComponent(config.style)}/descriptor?${params}`;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function createPinMap(container: HTMLElement, config: MapConfig, options: PinMapOptions): PinMap {
    const map = new MapLibreMap({
        container,
        style: styleUrl(config, options.dark),
        center: options.pin ? [options.pin.lng, options.pin.lat] : config.center,
        zoom: options.pin ? PIN_ZOOM : AREA_ZOOM,
        cooperativeGestures: options.cooperative ?? false,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const marker = new Marker({ draggable: true, color: '#0d729e' });
    const moved = (lat: number, lng: number) => options.onMove({ lat: round(lat), lng: round(lng) });

    marker.on('dragend', () => {
        const at = marker.getLngLat();
        moved(at.lat, at.lng);
    });

    map.on('click', (event) => {
        marker.setLngLat(event.lngLat).addTo(map);
        moved(event.lngLat.lat, event.lngLat.lng);
    });

    if (options.pin) marker.setLngLat([options.pin.lng, options.pin.lat]).addTo(map);

    return {
        setPin(at, fly = true) {
            marker.setLngLat([at.lng, at.lat]).addTo(map);
            if (fly) map.flyTo({ center: [at.lng, at.lat], zoom: Math.max(map.getZoom(), PIN_ZOOM - 1) });
        },
        clearPin() {
            marker.remove();
        },
        center() {
            const c = map.getCenter();
            return { lat: round(c.lat), lng: round(c.lng) };
        },
        destroy() {
            map.remove();
        },
    };
}
