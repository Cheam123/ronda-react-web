import clsx from 'clsx';
import { isEmptyValue } from '@/lib/forms/conditions';
import { parseGpsStamp, mapsUrl } from '@/lib/geolocation';
import FileAnswerList from './FileAnswerList';

/** One answered field on a record (FormController::responseSections). */
export interface ResponseFieldData {
    id: string | null;
    type: string;
    label: string;
    value: unknown;
    /** A checkbox field's full option list, to show unticked ones too. */
    options?: string[];
    /** A Person field's answer as names. */
    user_label?: string | null;
}

export interface ResponseSectionData {
    label: string | null;
    fields: ResponseFieldData[];
}

const WIDE_TYPES = ['textarea', 'file', 'checkbox', 'multi-choice', 'multi-select'];

function Value({ field, onImageClick }: { field: ResponseFieldData; onImageClick?: (src: string) => void }) {
    const { type, value } = field;

    if (isEmptyValue(value)) return <span className="rs-field-empty">&mdash;</span>;

    if (type === 'file') return <FileAnswerList value={value} onImageClick={onImageClick} />;

    if (type === 'checkbox' && field.options?.length) {
        const chosen = Array.isArray(value) ? value.map(String) : [];
        return (
            <div className="rs-check-list">
                {field.options.map((option) => {
                    const checked = chosen.includes(option);
                    return (
                        <div key={option} className="rs-check-item">
                            <span className={clsx('rs-check-icon', checked && 'rs-check-icon-on')}>
                                {checked && '✓'}
                            </span>
                            {option}
                        </div>
                    );
                })}
            </div>
        );
    }

    if (type === 'gps') {
        const stamp = parseGpsStamp(value);
        if (!stamp) return <span className="rs-field-empty">&mdash;</span>;
        const details = [
            typeof stamp.accuracy === 'number' ? `±${Math.round(stamp.accuracy)} m` : null,
            stamp.captured_at ? new Date(stamp.captured_at).toLocaleString() : null,
        ].filter(Boolean);
        return (
            <>
                <div className="rs-field-value">
                    <i className="mdi mdi-map-marker-outline me-1 text-muted" />
                    {stamp.lat}, {stamp.lng}
                    <a href={mapsUrl(stamp)} target="_blank" rel="noopener noreferrer" className="ms-1 small">
                        Open in Maps
                    </a>
                </div>
                {details.length > 0 && <div className="text-muted small">{details.join(' · ')}</div>}
            </>
        );
    }

    if (Array.isArray(value)) {
        return (
            <div className="rs-tag-list">
                {value
                    .filter((item) => item !== null && item !== '' && typeof item !== 'object')
                    .map((item, index) => (
                        <span key={`${String(item)}-${index}`} className="rs-tag">
                            {String(item)}
                        </span>
                    ))}
            </div>
        );
    }

    if (type === 'user') {
        return (
            <div className="rs-field-value">
                <i className="mdi mdi-account-outline me-1 text-muted" />
                {field.user_label}
            </div>
        );
    }

    if (type === 'textarea') return <p className="rs-field-text">{String(value)}</p>;

    if (type === 'email') {
        return (
            <div className="rs-field-value">
                <a href={`mailto:${String(value)}`}>{String(value)}</a>
            </div>
        );
    }

    return <div className="rs-field-value">{String(value)}</div>;
}

/** A read-only answer on the record page. */
export default function ResponseField({
    field,
    onImageClick,
}: {
    field: ResponseFieldData;
    onImageClick?: (src: string) => void;
}) {
    return (
        <div className={clsx('rs-field', WIDE_TYPES.includes(field.type) && 'rs-field-wide')}>
            <div className="rs-field-label">{field.label}</div>
            <Value field={field} onImageClick={onImageClick} />
        </div>
    );
}

/** Answers laid out in the form's own sections. */
export function ResponseSections({
    sections,
    onImageClick,
}: {
    sections: ResponseSectionData[];
    onImageClick?: (src: string) => void;
}) {
    return (
        <>
            {sections.map((section, index) => (
                <div key={`${section.label ?? 'fields'}-${index}`} className="rs-section">
                    {section.label && (
                        <div className="rs-section-head">
                            <div className="rs-section-label">{section.label}</div>
                        </div>
                    )}
                    <div className="rs-fields-grid">
                        {section.fields.map((field, fieldIndex) => (
                            <ResponseField key={field.id ?? fieldIndex} field={field} onImageClick={onImageClick} />
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}
