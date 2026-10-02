import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import FormRenderer from '@/Components/forms/FormRenderer';
import { useFormFill } from '@/hooks/useFormFill';
import { pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { FormSchema, Person } from '@/types/forms';
import type { FillStage } from './types';

interface FillStageCardProps {
    recordId: number;
    stage: FillStage;
    /** The whole form: conditions may look at answers from earlier steps. */
    schema: FormSchema;
    people: Person[];
    onImageClick: (src: string) => void;
}

/** The signed-in person's part of the form, filled in on the record page. */
export default function FillStageCard({ recordId, stage, schema, people, onImageClick }: FillStageCardProps) {
    const serverErrors = usePage<PageProps>().props.errors;
    const scopeIds = useMemo(() => stage.elements.map((element) => element.id), [stage.elements]);
    const fill = useFormFill({ schema, initial: stage.answers, scopeIds });
    const [sending, setSending] = useState(false);
    const [pulse, setPulse] = useState(false);
    const cardRef = useRef<HTMLElement>(null);
    const required = stage.elements.filter((element) => element.mandatory).length;

    // Bring the part that needs filling into view.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setPulse(true);
        }, 250);
        return () => window.clearTimeout(timer);
    }, []);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const firstProblem = fill.validate();
        if (firstProblem) {
            document.getElementById(`field-${firstProblem}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        router.post(
            route('form.admin.fill', recordId),
            {
                form_data: JSON.stringify(fill.entries().map(({ id, value }) => ({ id, value }))),
                files: fill.attachments(),
            },
            {
                forceFormData: true,
                preserveScroll: true,
                preserveState: 'errors',
                onStart: () => setSending(true),
                onFinish: () => setSending(false),
            },
        );
    };

    return (
        <section
            ref={cardRef}
            id="your-part"
            className={clsx('rd-panel rd-panel--flush form-record__card form-record__yours', pulse && 'is-pulsing')}
            aria-labelledby="your-part-title"
        >
            <div className="form-record__card-head">
                <div>
                    <span className="form-record__eyebrow">Your turn</span>
                    <h2 id="your-part-title" className="rd-panel__title">
                        {stage.name}
                    </h2>
                    <p className="rd-panel__sub">
                        {pluralize(stage.elements.length, 'field')} to fill in
                        {required > 0 && `, ${required} required`}
                    </p>
                </div>
            </div>
            <form onSubmit={submit} noValidate>
                <div className="form-record__fill">
                    <FormRenderer
                        items={stage.tree}
                        answers={fill.answers}
                        visibility={fill.visibility}
                        errors={{ ...serverErrors, ...fill.errors }}
                        files={fill.files}
                        onChange={fill.setAnswer}
                        onFiles={fill.setFiles}
                        people={people}
                        previous={stage.previous}
                        onImageClick={onImageClick}
                        layout="stacked"
                    />
                </div>
                <div className="rd-form__foot">
                    <button type="submit" className="rd-btn rd-btn--primary rd-btn--lg" disabled={sending}>
                        {sending && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                        Send my part
                    </button>
                </div>
            </form>
        </section>
    );
}
