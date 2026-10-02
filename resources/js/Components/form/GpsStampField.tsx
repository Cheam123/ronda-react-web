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

const WHEN = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
              stamp.captured_at ? `stamped ${WHEN.format(new Date(stamp.captured_at))}` : null,
          ].filter(Boolean)
        : [];

    return (
        <div className="gps-field">
            <div className="gps-field__card">
                <span className={clsx('gps-field__icon', stamp && 'is-stamped')} aria-hidden="true">
                    <i className={stamp ? 'mdi mdi-map-marker-outline' : 'mdi mdi-map-marker-off-outline'} />
                </span>
                <span className="gps-field__text">
                    {stamp ? (
                        <>
                            <span className="gps-field__coords">
                                {stamp.lat.toFixed(6)}, {stamp.lng.toFixed(6)}
                            </span>
                            <span className="gps-field__meta">
                                {details.join(' · ')}
                                {details.length > 0 && ' · '}
                                <a href={mapsUrl(stamp)} target="_blank" rel="noopener noreferrer">
                                    Open in Maps
                                </a>
                            </span>
                        </>
                    ) : (
                        <span className="gps-field__empty">Location not stamped yet.</span>
                    )}
                </span>
                {!readOnly && (
                    <button type="button" className="rd-btn" onClick={capture} disabled={busy}>
                        <i className="mdi mdi-crosshairs-gps" aria-hidden="true" />
                        {busy ? 'Stamping…' : buttonLabel}
                    </button>
                )}
            </div>
            {error && (
                <span className="rd-field__error" role="alert">
                    <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                    {error}
                </span>
            )}
        </div>
    );
}
