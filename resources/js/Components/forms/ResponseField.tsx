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

    if (isEmptyValue(value)) return <span className="rd-muted">&mdash;</span>;

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
        if (!stamp) return <span className="rd-muted">&mdash;</span>;
        const details = [
            typeof stamp.accuracy === 'number' ? `±${Math.round(stamp.accuracy)} m` : null,
            stamp.captured_at ? new Date(stamp.captured_at).toLocaleString() : null,
        ].filter(Boolean);
        return (
            <>
                <div className="rs-field-value">
                    <i className="mdi mdi-map-marker-outline" aria-hidden="true" />
                    {stamp.lat}, {stamp.lng}
                    <a href={mapsUrl(stamp)} target="_blank" rel="noopener noreferrer" className="rs-answer__link">
                        Open in Maps
                    </a>
                </div>
                {details.length > 0 && <div className="rd-muted">{details.join(' · ')}</div>}
            </>
        );
    }

    if (Array.isArray(value)) {
        return (
            <div className="rs-answer__tags">
                {value
                    .filter((item) => item !== null && item !== '' && typeof item !== 'object')
                    .map((item, index) => (
                        <span key={`${String(item)}-${index}`} className="rd-tag">
                            {String(item)}
                        </span>
                    ))}
            </div>
        );
    }

    if (type === 'user') {
        return (
            <div className="rs-field-value">
                <i className="mdi mdi-account-outline" aria-hidden="true" />
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

/** A read-only answer on the record page: the question, then what was answered. */
export default function ResponseField({
    field,
    onImageClick,
}: {
    field: ResponseFieldData;
    onImageClick?: (src: string) => void;
}) {
    return (
        <div className={clsx('rs-answer', WIDE_TYPES.includes(field.type) && 'is-wide')}>
            <dt className="rs-answer__label">{field.label}</dt>
            <dd className="rs-answer__value">
                <Value field={field} onImageClick={onImageClick} />
            </dd>
        </div>
    );
}

/** Answers laid out in the form's own groups. */
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
                <section key={`${section.label ?? 'fields'}-${index}`} className="rs-section">
                    {section.label && <h3 className="rs-section__title">{section.label}</h3>}
                    <dl className="rs-answers">
                        {section.fields.map((field, fieldIndex) => (
                            <ResponseField key={field.id ?? fieldIndex} field={field} onImageClick={onImageClick} />
                        ))}
                    </dl>
                </section>
            ))}
        </>
    );
}
