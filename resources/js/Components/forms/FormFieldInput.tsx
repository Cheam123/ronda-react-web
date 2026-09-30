import clsx from 'clsx';
import SearchSelect from '@/Components/form/SearchSelect';
import GpsStampField from '@/Components/form/GpsStampField';
import { formatFileSize } from '@/lib/files';
import { optionList, peopleFor } from '@/lib/forms/schema';
import type { AnswerValue, FieldElement, GpsAnswer, OptionCategory, Person } from '@/types/forms';
import FileAnswerList from './FileAnswerList';

/** Attachments over this size are refused by the server (FormUploadService::MAX_KB). */
const MAX_FILE_BYTES = 10240 * 1024;

interface FormFieldInputProps {
    element: FieldElement;
    value: AnswerValue;
    onChange: (value: AnswerValue) => void;
    /** Attachments picked for a file field, not yet posted. */
    files?: File[];
    onFiles?: (files: File[]) => void;
    error?: string;
    disabled?: boolean;
    /** Everyone a Person field may offer. */
    people: Person[];
    onImageClick?: (src: string) => void;
}

const asText = (value: AnswerValue): string =>
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const asList = (value: AnswerValue): string[] => (Array.isArray(value) ? value.map(String) : []);

/** "(Select 2 to 4 options)" under a multiple-choice field. */
function MinMaxHint({ element }: { element: FieldElement }) {
    const min = element.min ? Number(element.min) : null;
    const max = element.max ? Number(element.max) : null;
    if (!min && !max) return null;

    const text = min && max ? `${min} to ${max} options` : min ? `at least ${min} option(s)` : `up to ${max} option(s)`;
    return <small className="text-muted d-block mb-2">(Select {text})</small>;
}

/** One form field, labelled, with its validation message. */
export default function FormFieldInput({
    element,
    value,
    onChange,
    files = [],
    onFiles,
    error,
    disabled = false,
    people,
    onImageClick,
}: FormFieldInputProps) {
    const id = `field-${element.id}`;
    const placeholder = element.placeholder || `Enter ${element.label ?? ''}`;
    const toggle = (option: string) => {
        const chosen = asList(value);
        onChange(chosen.includes(option) ? chosen.filter((item) => item !== option) : [...chosen, option]);
    };

    const checkboxes = (options: string[], prefix: string) =>
        options.map((option, index) => (
            <div className="form-check" key={`${option}-${index}`}>
                <input
                    className="form-check-input"
                    type="checkbox"
                    id={`${prefix}_${element.id}_${index}`}
                    checked={asList(value).includes(option)}
                    disabled={disabled}
                    onChange={() => toggle(option)}
                />
                <label className="form-check-label" htmlFor={`${prefix}_${element.id}_${index}`}>
                    {option}
                </label>
            </div>
        ));

    const control = (() => {
        switch (element.type) {
            case 'textarea':
                return (
                    <textarea
                        id={id}
                        className={clsx('form-control', error && 'is-invalid')}
                        rows={4}
                        placeholder={placeholder}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );

            case 'date': {
                const minDays = Number(element.min_days ?? 0);
                const min =
                    minDays > 0 ? new Date(Date.now() + minDays * 86_400_000).toLocaleDateString('en-CA') : undefined;
                return (
                    <input
                        id={id}
                        type="date"
                        className={clsx('form-control', error && 'is-invalid')}
                        min={min}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
            }

            case 'time':
                return (
                    <input
                        id={id}
                        type="time"
                        className={clsx('form-control', error && 'is-invalid')}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );

            case 'select':
                return (
                    <SearchSelect
                        id={id}
                        options={optionList(element).map((option) => ({ value: option, label: option }))}
                        placeholder={element.placeholder || 'Select an option'}
                        disabled={disabled}
                        invalid={!!error}
                        value={asText(value)}
                        onChange={(picked) => onChange(picked || null)}
                    />
                );

            case 'user':
                return (
                    <SearchSelect
                        id={id}
                        options={peopleFor(element, people).map((person) => ({ value: person.id, label: person.name }))}
                        placeholder={element.placeholder || 'Select a person'}
                        disabled={disabled}
                        invalid={!!error}
                        value={asText(value)}
                        onChange={(picked) => onChange(picked || null)}
                    />
                );

            case 'multi-choice':
                return (
                    <div id={id} className={clsx('border rounded p-3', error && 'border-danger')}>
                        <MinMaxHint element={element} />
                        {checkboxes(optionList(element), 'mc')}
                    </div>
                );

            case 'multi-select':
                return (
                    <div id={id} className={clsx('border rounded p-3', error && 'border-danger')}>
                        <MinMaxHint element={element} />
                        {(element.values as OptionCategory[])
                            .filter((category) => category && typeof category === 'object')
                            .map((category, index) => (
                                <div className="mb-3" key={`${category.group}-${index}`}>
                                    <strong className="d-block mb-2">{category.group}</strong>
                                    <div className="ms-3">
                                        {checkboxes((category.options ?? []).filter(Boolean), `ms${index}`)}
                                    </div>
                                </div>
                            ))}
                    </div>
                );

            case 'checkbox':
                return <div id={id}>{checkboxes(optionList(element), 'cb')}</div>;

            case 'file': {
                const tooBig = files.filter((file) => file.size > MAX_FILE_BYTES).length;
                return (
                    <>
                        {value && value !== '__files_attached__' && (
                            <div className="mb-2">
                                <div className="text-muted small mb-1">
                                    <i className="mdi mdi-paperclip me-1" />
                                    Attached
                                </div>
                                <FileAnswerList value={value} onImageClick={onImageClick} />
                                {!disabled && <div className="form-text small">Choosing new files replaces these.</div>}
                            </div>
                        )}
                        <input
                            id={id}
                            type="file"
                            multiple
                            className="form-control"
                            disabled={disabled}
                            onChange={(event) => onFiles?.(Array.from(event.target.files ?? []))}
                        />
                        {files.length > 0 && (
                            <div className="mt-1">
                                {files.map((file, index) => (
                                    <span key={`${file.name}-${index}`} className="file-answers__chip me-1 mb-1">
                                        <i className="mdi mdi-paperclip me-1" />
                                        {file.name} · {formatFileSize(file.size)}
                                    </span>
                                ))}
                                {tooBig > 0 && (
                                    <div className="text-danger small mt-1">
                                        <i className="mdi mdi-alert-circle me-1" />
                                        {tooBig} file(s) are over the 10 MB limit and will be rejected.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                );
            }

            case 'gps':
                return (
                    <GpsStampField
                        value={value && typeof value === 'object' && 'lat' in value ? JSON.stringify(value) : ''}
                        onChange={(stamp) => onChange(stamp ? (JSON.parse(stamp) as GpsAnswer) : null)}
                        readOnly={disabled}
                        autoCapture={element.capture_mode !== 'manual'}
                    />
                );

            default:
                return (
                    <input
                        id={id}
                        type={['email', 'tel', 'number'].includes(element.type) ? element.type : 'text'}
                        className={clsx('form-control', error && 'is-invalid')}
                        placeholder={placeholder}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
        }
    })();

    return (
        <>
            <label className="form-label fw-bold" htmlFor={id}>
                {element.label || 'Untitled Field'}
                {element.mandatory && <span className="text-danger"> *</span>}
            </label>
            {control}
            {error && <div className="invalid-feedback d-block">{error}</div>}
        </>
    );
}
