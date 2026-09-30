import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import FormRenderer from '@/Components/forms/FormRenderer';
import Button from '@/Components/ui/Button';
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

/** A Handler's section of the form, filled in on the record page. */
export default function FillStageCard({ recordId, stage, schema, people, onImageClick }: FillStageCardProps) {
    const serverErrors = usePage<PageProps>().props.errors;
    const scopeIds = useMemo(() => stage.elements.map((element) => element.id), [stage.elements]);
    const fill = useFormFill({ schema, initial: stage.answers, scopeIds });
    const [sending, setSending] = useState(false);
    const [pulse, setPulse] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const required = stage.elements.filter((element) => element.mandatory).length;

    // Bring the section that needs filling into view.
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
        <div ref={cardRef} className={`rs-card fill-stage-card${pulse ? ' fill-attn' : ''}`}>
            <div className="rs-card-head">
                <div>
                    <div className="rs-card-title">
                        <span className="fill-stage-card__dot" />
                        {stage.name} — your section
                    </div>
                    <div className="rs-card-meta mt-1">
                        {pluralize(stage.elements.length, 'field')}
                        {required > 0 && ` · ${required} required`}
                    </div>
                </div>
                <span className="rs-fill-badge">Awaiting your input</span>
            </div>
            <div className="rs-card-body py-4">
                <form onSubmit={submit} noValidate>
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
                        grid
                    />
                    <div className="text-center pt-2 border-top mt-2">
                        <Button type="submit" className="mt-3 btn-handler" icon="mdi mdi-check" loading={sending}>
                            Submit My Section
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
