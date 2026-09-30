import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { captureGpsStamp, mapsUrl, parseGpsStamp } from '@/lib/geolocation';

interface GpsStampFieldProps {
    /** The stamp as a JSON string ('' when there is none). */
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    /** Stamp as soon as the field appears instead of waiting for the button. */
    autoCapture?: boolean;
}

/**
 * A "Stamp location" field. In auto mode it captures once when it mounts; a
 * failed auto capture is not retried on its own, the button offers "Retry".
 */
export default function GpsStampField({ value, onChange, readOnly = false, autoCapture = false }: GpsStampFieldProps) {
    const stamp = parseGpsStamp(value);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const autoTried = useRef(false);

    const capture = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            onChange(JSON.stringify(await captureGpsStamp()));
        } catch (reason) {
            // A failed recapture keeps the previous stamp; only the status changes.
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            setBusy(false);
        }
    }, [onChange]);

    useEffect(() => {
        if (autoCapture && !readOnly && !value && !autoTried.current) {
            autoTried.current = true;
            void capture();
        }
    }, [autoCapture, readOnly, value, capture]);

    const buttonLabel = stamp ? 'Stamp again' : error ? 'Retry' : 'Stamp location';
    const details = stamp
        ? [
              typeof stamp.accuracy === 'number' ? `±${Math.round(stamp.accuracy)} m` : null,
              stamp.captured_at ? new Date(stamp.captured_at).toLocaleString() : null,
          ].filter(Boolean)
        : [];

    return (
        <div className="gps-field border rounded p-2">
            <div className="d-flex flex-wrap align-items-center gap-2">
                <div className={clsx('flex-grow-1 small', !stamp && 'text-muted')}>
                    {stamp ? (
                        <>
                            <i className="mdi mdi-map-marker text-success me-1" />
                            <span className="fw-semibold">
                                {stamp.lat.toFixed(6)}, {stamp.lng.toFixed(6)}
                            </span>
                            {details.length > 0 && <span className="text-muted"> · {details.join(' · ')}</span>}
                            <a href={mapsUrl(stamp)} target="_blank" rel="noopener noreferrer" className="ms-1">
                                Open in Maps
                            </a>
                        </>
                    ) : (
                        <>
                            <i className="mdi mdi-map-marker-off-outline me-1" />
                            Location not stamped yet.
                        </>
                    )}
                </div>
                {!readOnly && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={capture} disabled={busy}>
                        <i className="mdi mdi-crosshairs-gps me-1" />
                        {buttonLabel}
                    </button>
                )}
            </div>
            {(busy || error) && (
                <div className={clsx('small mt-1', error ? 'text-danger' : 'text-muted')}>
                    {busy ? 'Stamping your location…' : error}
                </div>
            )}
        </div>
    );
}
