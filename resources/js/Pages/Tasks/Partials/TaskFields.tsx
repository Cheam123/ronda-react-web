import clsx from 'clsx';
import { lazy, Suspense } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextInput from '@/Components/form/TextInput';
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

const ALERT_OPTIONS = [
    { value: '1', label: 'NO' },
    { value: '2', label: 'YES' },
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

/** Task Detail: who handles it, what it is, when it's due and the remark. */
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
                <div className="row">
                    <Field
                        label="Subscriber"
                        htmlFor="subscriber"
                        required={subscriberEditable}
                        error={errors.subscriber}
                        className="col-md-3"
                    >
                        {subscriberEditable && !readOnly ? (
                            <SearchSelect
                                id="subscriber"
                                options={people}
                                placeholder="-- Select Your Choice --"
                                invalid={!!errors.subscriber}
                                value={data.subscriber}
                                onChange={(value) => update('subscriber', value)}
                            />
                        ) : (
                            <TextInput id="subscriber" value={names?.subscriber ?? ''} readOnly />
                        )}
                    </Field>
                    <Field label="Sub-Subscriber(s)" htmlFor="sub_subscriber" className="col-md-3">
                        <MultiSearchSelect
                            id="sub_subscriber"
                            options={people}
                            placeholder=""
                            disabled={readOnly}
                            value={data.sub_subscriber}
                            onChange={(values) => update('sub_subscriber', values)}
                        />
                    </Field>
                    <Field
                        label="Owner(s)"
                        htmlFor="owner"
                        required={!readOnly}
                        error={errors.owner}
                        className="col-md-3"
                    >
                        <MultiSearchSelect
                            id="owner"
                            options={people}
                            placeholder=""
                            disabled={readOnly}
                            invalid={!!errors.owner}
                            value={data.owner}
                            onChange={(values) => update('owner', values)}
                        />
                    </Field>
                    <Field label="Viewer(s)" htmlFor="viewer" className="col-md-3">
                        <MultiSearchSelect
                            id="viewer"
                            options={people}
                            placeholder=""
                            disabled={readOnly}
                            value={data.viewer}
                            onChange={(values) => update('viewer', values)}
                        />
                    </Field>
                    {editing && (
                        <>
                            <Field label="Creator" htmlFor="creator" className="col-md-3">
                                <TextInput id="creator" value={names?.creator ?? ''} readOnly />
                            </Field>
                            <Field label="Checker" htmlFor="checker" className="col-md-3">
                                <TextInput id="checker" value={names?.checker ?? ''} readOnly />
                            </Field>
                        </>
                    )}
                    {mode === 'edit' && (
                        <Field label="ALERT" htmlFor="alertind" className="col-md-3">
                            <Select
                                id="alertind"
                                placeholder="-- Select Your Choice --"
                                options={ALERT_OPTIONS}
                                value={data.alertind}
                                onChange={(event) => update('alertind', event.target.value)}
                            />
                        </Field>
                    )}
                </div>
            )}

            <div className="row">
                <Field label="Title" htmlFor="title" required={!readOnly} error={errors.title} className="col-12">
                    <TextInput
                        id="title"
                        readOnly={readOnly}
                        invalid={!!errors.title}
                        value={data.title}
                        onChange={(event) => update('title', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <DateTimeField
                    label="Task Start"
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
                    label="Task Due"
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
                    label="Appointment Date Time"
                    name="task_appointment"
                    readOnly={readOnly}
                    date={data.task_appointment_date}
                    time={data.task_appointment_time}
                    error={errors.task_appointment_date ?? errors.task_appointment_time}
                    onDate={(value) => update('task_appointment_date', value)}
                    onTime={(value) => update('task_appointment_time', value)}
                />
            </div>

            {editing && (
                <div className="row">
                    <Field label="Invoice No" htmlFor="invoice_no" className="col-md-3">
                        <TextInput
                            id="invoice_no"
                            maxLength={100}
                            readOnly={readOnly}
                            className={clsx(readOnly && data.invoice_no && 'is-recorded')}
                            value={data.invoice_no}
                            onChange={(event) => update('invoice_no', event.target.value)}
                        />
                    </Field>
                    <Field label="Sales Amount" htmlFor="sales" className="col-md-3">
                        {readOnly ? (
                            <TextInput
                                id="sales"
                                className={clsx(Number(data.sales) > 0 && 'is-recorded')}
                                value={`RM ${data.sales}`}
                                readOnly
                            />
                        ) : (
                            <TextInput
                                id="sales"
                                type="number"
                                step="any"
                                value={data.sales}
                                onChange={(event) => update('sales', event.target.value)}
                            />
                        )}
                    </Field>
                </div>
            )}

            <div className="row">
                <Field label="Remark" htmlFor="remark" error={errors.remark} className="col-12">
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
            </div>
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

function DateTimeField({ label, name, date, time, required, readOnly, error, onDate, onTime }: DateTimeFieldProps) {
    return (
        <Field label={label} htmlFor={`${name}_date`} required={required} error={error} className="col-md-4 col-xl-3">
            <div className="row g-1">
                <div className="col-6">
                    <TextInput
                        id={`${name}_date`}
                        type="date"
                        aria-label={`${label} date`}
                        readOnly={readOnly}
                        invalid={!!error}
                        value={date}
                        onChange={(event) => onDate(event.target.value)}
                    />
                </div>
                <div className="col-6">
                    <TextInput
                        id={`${name}_time`}
                        type="time"
                        aria-label={`${label} time`}
                        readOnly={readOnly}
                        invalid={!!error}
                        value={time}
                        onChange={(event) => onTime(event.target.value)}
                    />
                </div>
            </div>
        </Field>
    );
}
