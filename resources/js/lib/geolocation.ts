/**
 * Location stamps: {lat, lng, accuracy, captured_at}, posted as a JSON
 * string. The value is only ever written from the browser's geolocation,
 * never typed.
 */

export interface GpsStamp {
    lat: number;
    lng: number;
    accuracy: number | null;
    captured_at: string;
}

const GEO_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

export function parseGpsStamp(value: unknown): GpsStamp | null {
    if (!value) return null;

    try {
        const parsed = (typeof value === 'string' ? JSON.parse(value) : value) as Partial<GpsStamp>;
        return typeof parsed.lat === 'number' && typeof parsed.lng === 'number' ? (parsed as GpsStamp) : null;
    } catch {
        return null;
    }
}

function failureMessage(error: GeolocationPositionError | null): string {
    switch (error?.code) {
        case 1:
            return 'We could not check your location. Please check your browser’s permission for this site and retry.';
        case 2:
            return 'We could not find your location right now. Please turn on location services and retry.';
        case 3:
            return 'Finding your location took too long. Please retry.';
        default:
            return 'We could not stamp your location. Please retry.';
    }
}

/** Ask the browser where we are. Rejects with a message fit to show the user. */
export function captureGpsStamp(): Promise<GpsStamp> {
    return new Promise((resolve, reject) => {
        if (!window.isSecureContext) {
            reject(new Error('We can only stamp your location on a secure (https) page.'));
            return;
        }
        if (!navigator.geolocation) {
            reject(new Error('This browser cannot share your location.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) =>
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
                    captured_at: new Date(position.timestamp || Date.now()).toISOString(),
                }),
            (error) => reject(new Error(failureMessage(error))),
            GEO_OPTIONS,
        );
    });
}

export function mapsUrl(stamp: Pick<GpsStamp, 'lat' | 'lng'>): string {
    return `https://www.google.com/maps?q=${stamp.lat},${stamp.lng}`;
}
