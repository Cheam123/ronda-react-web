import { lazy, Suspense } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import TextInput from '@/Components/form/TextInput';
import { Choices } from '@/Components/surface/Choices';
import { FormRow, FormSection } from '@/Components/surface/FormSection';
import SafeHtml from '@/Components/ui/SafeHtml';
import type { SelectOption } from '@/types';

/** The task form's fields, named as TaskCreateRequest / TaskSaveRequest expect them. */
export interface TaskFormData {
    subscriber: string;
    sub_subscriber: string[];
    owner: string[];
    viewer: string[];
    alertind: string;
    title: string;
    task_start_date: string;
    task_start_time: string;
    task_due_date: string;
    task_due_time: string;
    task_appointment_date: string;
    task_appointment_time: string;
    invoice_no: string;
    sales: string;
    remark: string;
}

// The editor is heavy; the read-only view never loads it.
const RichTextEditor = lazy(() => import('@/Components/editor/RichTextEditor'));

// alertind: 2 alerts the people on the task, 1 does not.
const ALERT_OPTIONS: SelectOption[] = [
    { value: '2', label: 'Yes' },
    { value: '1', label: 'No' },
];

interface TaskFieldsProps {
    /** create: new task; edit: the owner's form; view: everything read-only. */
    mode: 'create' | 'edit' | 'view';
    data: TaskFormData;
    setData?: <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => void;
    errors?: Partial<Record<string, string>>;
    people: SelectOption<number>[];
    /** Whether the people pickers show at all (create: assigning to others). */
    showPeople?: boolean;
    /** Whether the subscriber can be changed (edit: owner or admin). */
    subscriberEditable?: boolean;
    /** Names shown read-only on edit and view. */
    names?: { subscriber: string | null; creator: string | null; checker: string | null };
}

/** The task form's sections: who handles it, what and when, and the remark. */
export default function TaskFields({
    mode,
    data,
    setData,
    errors = {},
    people,
    showPeople = true,
    subscriberEditable = mode === 'create',
    names,
}: TaskFieldsProps) {
    const readOnly = mode === 'view';
    const editing = mode !== 'create';
    const update = <K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) => setData?.(key, value);

    return (
        <>
            {showPeople && (
                <FormSection title="People" intro="Who does it, who helps, who signs it off and who can watch.">
                    <FormRow>
                        <Field
                            label="Subscriber"
                            htmlFor="subscriber"
                            required={subscriberEditable && !readOnly}
                            error={errors.subscriber}
                            hint={subscriberEditable && !readOnly ? 'The one person doing the task.' : undefined}
                        >
                            {subscriberEditable && !readOnly ? (
                                <SearchSelect
                                    id="subscriber"
                                    options={people}
                                    placeholder="Choose a person"
                                    invalid={!!errors.subscriber}
                                    value={data.subscriber}
                                    onChange={(value) => update('subscriber', value)}
                                />
                            ) : (
                                <TextInput id="subscriber" large value={names?.subscriber ?? ''} readOnly />
                            )}
                        </Field>
                        <Field label="Sub-subscribers" htmlFor="sub_subscriber">
                            <MultiSearchSelect
                                id="sub_subscriber"
                                options={people}
                                placeholder={readOnly ? '—' : 'Anyone helping'}
                                disabled={readOnly}
                                value={data.sub_subscriber}
                                onChange={(values) => update('sub_subscriber', values)}
                            />
                        </Field>
                    </FormRow>
                    <FormRow>
                        <Field label="Owners" htmlFor="owner" required={!readOnly} error={errors.owner}>
                            <MultiSearchSelect
                                id="owner"
                                options={people}
                                placeholder={readOnly ? '—' : 'Who it answers to'}
                                disabled={readOnly}
                                invalid={!!errors.owner}
                                value={data.owner}
                                onChange={(values) => update('owner', values)}
                            />
                        </Field>
                        <Field label="Viewers" htmlFor="viewer">
                            <MultiSearchSelect
                                id="viewer"
                                options={people}
                                placeholder={readOnly ? '—' : 'Anyone else who should see it'}
                                disabled={readOnly}
                                value={data.viewer}
                                onChange={(values) => update('viewer', values)}
                            />
                        </Field>
                    </FormRow>
                    {editing && (
                        <FormRow>
                            <Field label="Created by" htmlFor="creator">
                                <TextInput id="creator" large value={names?.creator ?? ''} readOnly />
                            </Field>
                            <Field label="Checker" htmlFor="checker">
                                <TextInput id="checker" large value={names?.checker ?? ''} readOnly />
                            </Field>
                        </FormRow>
                    )}
                    {mode === 'edit' && (
                        <Choices
                            legend="Alert the people on it"
                            options={ALERT_OPTIONS}
                            required
                            value={data.alertind}
                            onChange={(value) => update('alertind', value)}
                        />
                    )}
                </FormSection>
            )}

            <FormSection title="Task" intro="What to do and by when.">
                <Field label="Title" htmlFor="title" required={!readOnly} error={errors.title}>
                    <TextInput
                        id="title"
                        large
                        maxLength={255}
                        readOnly={readOnly}
                        invalid={!!errors.title}
                        value={data.title}
                        onChange={(event) => update('title', event.target.value)}
                    />
                </Field>
                <FormRow columns="repeat(auto-fit, minmax(280px, 1fr))">
                    <DateTimeField
                        label="Starts"
                        name="task_start"
                        required={!readOnly}
                        readOnly={readOnly}
                        date={data.task_start_date}
                        time={data.task_start_time}
                        error={errors.task_start_date ?? errors.task_start_time}
                        onDate={(value) => update('task_start_date', value)}
                        onTime={(value) => update('task_start_time', value)}
                    />
                    <DateTimeField
                        label="Due"
                        name="task_due"
                        required={!readOnly}
                        readOnly={readOnly}
                        date={data.task_due_date}
                        time={data.task_due_time}
                        error={errors.task_due_date ?? errors.task_due_time}
                        onDate={(value) => update('task_due_date', value)}
                        onTime={(value) => update('task_due_time', value)}
                    />
                    <DateTimeField
                        label="Appointment"
                        name="task_appointment"
                        readOnly={readOnly}
                        date={data.task_appointment_date}
                        time={data.task_appointment_time}
                        error={errors.task_appointment_date ?? errors.task_appointment_time}
                        onDate={(value) => update('task_appointment_date', value)}
                        onTime={(value) => update('task_appointment_time', value)}
                    />
                </FormRow>
                {editing && (
                    <FormRow columns="minmax(0, 1fr) minmax(0, 1fr)">
                        <Field label="Invoice no." htmlFor="invoice_no">
                            <TextInput
                                id="invoice_no"
                                large
                                className="rd-input--mono"
                                maxLength={100}
                                readOnly={readOnly}
                                value={data.invoice_no}
                                onChange={(event) => update('invoice_no', event.target.value)}
                            />
                        </Field>
                        <Field label="Sales amount" htmlFor="sales">
                            <div className="rd-affix rd-affix--full">
                                <span className="rd-affix__start">RM</span>
                                <input
                                    id="sales"
                                    type="number"
                                    step="any"
                                    min={0}
                                    readOnly={readOnly}
                                    value={data.sales}
                                    onChange={(event) => update('sales', event.target.value)}
                                />
                            </div>
                        </Field>
                    </FormRow>
                )}
            </FormSection>

            <FormSection title="Remark" intro="What the subscriber needs to know.">
                <Field label="Remark" htmlFor="remark" error={errors.remark}>
                    {readOnly ? (
                        <SafeHtml html={data.remark} className="rich-text rich-text__content rich-text--readonly" />
                    ) : (
                        <Suspense fallback={<div className="rich-text rich-text__content" />}>
                            <RichTextEditor
                                id="remark"
                                value={data.remark}
                                onChange={(html) => update('remark', html)}
                            />
                        </Suspense>
                    )}
                </Field>
            </FormSection>
        </>
    );
}

interface DateTimeFieldProps {
    label: string;
    name: string;
    date: string;
    time: string;
    required?: boolean;
    readOnly?: boolean;
    error?: string;
    onDate: (value: string) => void;
    onTime: (value: string) => void;
}

/** A date and a time side by side under one label. */
function DateTimeField({ label, name, date, time, required, readOnly, error, onDate, onTime }: DateTimeFieldProps) {
    return (
        <Field label={label} htmlFor={`${name}_date`} required={required} error={error}>
            <div className="task-when">
                <TextInput
                    id={`${name}_date`}
                    type="date"
                    large
                    aria-label={`${label}: date`}
                    readOnly={readOnly}
                    invalid={!!error}
                    value={date}
                    onChange={(event) => onDate(event.target.value)}
                />
                <TextInput
                    id={`${name}_time`}
                    type="time"
                    large
                    aria-label={`${label}: time`}
                    readOnly={readOnly}
                    invalid={!!error}
                    value={time}
                    onChange={(event) => onTime(event.target.value)}
                />
            </div>
        </Field>
    );
}
