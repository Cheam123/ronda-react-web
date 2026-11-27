/**
 * The map page the phone app shows in its map picker (resources/views/map-frame.blade.php).
 * The app drives it through window.rondaMap and hears back through
 * window.ReactNativeWebView.postMessage:
 *
 *   app → page:  rondaMap.setPin(lat, lng)    rondaMap.clearPin()
 *   page → app:  {type: 'ready', center}      {type: 'moved', lat, lng}
 *
 * ?lat=&lng= opens the map on a saved pin.
 */
import { createPinMap, type LatLng, type MapConfig } from './lib/amazonMap';

declare global {
    interface Window {
        RONDA_MAP?: MapConfig;
        ReactNativeWebView?: { postMessage(message: string): void };
        rondaMap?: {
            setPin(lat: number, lng: number): void;
            clearPin(): void;
            center(): LatLng;
        };
    }
}

const send = (message: Record<string, unknown>) => window.ReactNativeWebView?.postMessage(JSON.stringify(message));

const params = new URLSearchParams(window.location.search);
const lat = Number(params.get('lat'));
const lng = Number(params.get('lng'));
const pin =
    params.has('lat') && params.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
const container = document.getElementById('map');

if (window.RONDA_MAP && container) {
    const map = createPinMap(container, window.RONDA_MAP, {
        pin,
        onMove: (at) => send({ type: 'moved', ...at }),
        dark: params.get('theme') === 'dark',
    });

    window.rondaMap = {
        setPin: (toLat, toLng) => map.setPin({ lat: toLat, lng: toLng }),
        clearPin: () => map.clearPin(),
        center: () => map.center(),
    };

    send({ type: 'ready', center: map.center() });
}
