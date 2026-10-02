import clsx from 'clsx';
import type { ReactNode } from 'react';
import PendingFiles from '@/Components/documents/PendingFiles';
import { useToast } from '@/Components/feedback/ToastProvider';
import FileDropzone from '@/Components/form/FileDropzone';
import GpsStampField from '@/Components/form/GpsStampField';
import SearchSelect from '@/Components/form/SearchSelect';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { optionList, peopleFor } from '@/lib/forms/schema';
import type { AnswerValue, FieldElement, GpsAnswer, OptionCategory, Person } from '@/types/forms';
import FileAnswerList from './FileAnswerList';

/** Attachments over this size are refused by the server (FormUploadService::MAX_KB). */
const MAX_FILE_MB = 10;

/** Fields answered by ticking several boxes: a fieldset, not one labelled control. */
const GROUPED = ['multi-choice', 'multi-select', 'checkbox'];

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

/** "Pick 2 to 4." under a multiple-choice field. */
function pickHint(element: FieldElement): string | null {
    const min = element.min ? Number(element.min) : null;
    const max = element.max ? Number(element.max) : null;
    if (!min && !max) return null;

    return min && max ? `Pick ${min} to ${max}.` : min ? `Pick at least ${min}.` : `Pick up to ${max}.`;
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
    const toast = useToast();
    const id = `field-${element.id}`;
    const placeholder = element.placeholder || undefined;
    const invalid = Boolean(error);
    const toggle = (option: string) => {
        const chosen = asList(value);
        onChange(chosen.includes(option) ? chosen.filter((item) => item !== option) : [...chosen, option]);
    };

    const checkboxes = (options: string[], prefix: string) => (
        <div className="form-choices">
            {options.map((option, index) => (
                <label key={`${option}-${index}`} className="form-choice">
                    <input
                        type="checkbox"
                        className="rd-check"
                        id={`${prefix}_${element.id}_${index}`}
                        checked={asList(value).includes(option)}
                        disabled={disabled}
                        onChange={() => toggle(option)}
                    />
                    <span>{option}</span>
                </label>
            ))}
        </div>
    );

    const control = (() => {
        switch (element.type) {
            case 'textarea':
                return (
                    <TextArea
                        id={id}
                        rows={4}
                        placeholder={placeholder}
                        invalid={invalid}
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
                    <TextInput
                        id={id}
                        type="date"
                        large
                        min={min}
                        invalid={invalid}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
            }

            case 'time':
                return (
                    <TextInput
                        id={id}
                        type="time"
                        large
                        invalid={invalid}
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
                        placeholder={element.placeholder || 'Choose one'}
                        disabled={disabled}
                        invalid={invalid}
                        value={asText(value)}
                        onChange={(picked) => onChange(picked || null)}
                    />
                );

            case 'user':
                return (
                    <SearchSelect
                        id={id}
                        options={peopleFor(element, people).map((person) => ({ value: person.id, label: person.name }))}
                        placeholder={element.placeholder || 'Choose a person'}
                        disabled={disabled}
                        invalid={invalid}
                        value={asText(value)}
                        onChange={(picked) => onChange(picked || null)}
                    />
                );

            case 'multi-choice':
                return checkboxes(optionList(element), 'mc');

            case 'multi-select':
                return (
                    <div className="form-categories">
                        {(element.values as OptionCategory[])
                            .filter((category) => category && typeof category === 'object')
                            .map((category, index) => (
                                <div key={`${category.group}-${index}`} className="form-categories__group">
                                    <span className="form-categories__name">{category.group}</span>
                                    {checkboxes((category.options ?? []).filter(Boolean), `ms${index}`)}
                                </div>
                            ))}
                    </div>
                );

            case 'checkbox':
                return checkboxes(optionList(element), 'cb');

            case 'file':
                return (
                    <div className="form-files">
                        {value && value !== '__files_attached__' && (
                            <div className="form-files__saved">
                                <FileAnswerList value={value} onImageClick={onImageClick} />
                                {!disabled && (
                                    <span className="rd-field__hint">Choosing new files replaces these.</span>
                                )}
                            </div>
                        )}
                        {!disabled && (
                            <>
                                <FileDropzone
                                    maxSizeMb={MAX_FILE_MB}
                                    hint={`Photos, PDFs and documents, up to ${MAX_FILE_MB} MB each`}
                                    onFiles={(picked) => onFiles?.([...files, ...picked])}
                                    onReject={(message) => toast(message, 'error')}
                                />
                                <PendingFiles
                                    files={files}
                                    onRemove={(index) => onFiles?.(files.filter((_, position) => position !== index))}
                                />
                            </>
                        )}
                    </div>
                );

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
                    <TextInput
                        id={id}
                        type={['email', 'tel', 'number'].includes(element.type) ? element.type : 'text'}
                        large
                        placeholder={placeholder}
                        invalid={invalid}
                        disabled={disabled}
                        value={asText(value)}
                        onChange={(event) => onChange(event.target.value)}
                    />
                );
        }
    })();

    const label: ReactNode = (
        <>
            {element.label || 'Untitled field'}
            {element.mandatory && (
                <span className="rd-field__required" aria-hidden="true">
                    {' '}
                    *
                </span>
            )}
        </>
    );
    const hint = element.type === 'multi-choice' || element.type === 'multi-select' ? pickHint(element) : null;
    const message = error ? (
        <span className="rd-field__error" role="alert">
            <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
            {error}
        </span>
    ) : (
        hint && <span className="rd-field__hint">{hint}</span>
    );

    if (GROUPED.includes(element.type)) {
        return (
            <fieldset id={id} className={clsx('rd-fieldset', error && 'has-error')}>
                <legend className="rd-field__label">{label}</legend>
                {control}
                {message}
            </fieldset>
        );
    }

    return (
        <div className={clsx('rd-field', error && 'has-error')}>
            {element.type === 'gps' || element.type === 'file' ? (
                <span className="rd-field__label" id={id}>
                    {label}
                </span>
            ) : (
                <label htmlFor={id} className="rd-field__label">
                    {label}
                </label>
            )}
            {control}
            {message}
        </div>
    );
}
