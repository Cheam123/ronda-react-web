import ProcessSummary from '@/Components/forms/ProcessSummary';
import { isField } from '@/lib/forms/schema';
import type { FormSchema, ProcessDefinition } from '@/types/forms';

interface AfterSubmitProps {
    process: ProcessDefinition;
    /** user id -> name for everyone the process names. */
    names: Record<string, string>;
    schema: FormSchema;
    title?: string;
    /** Under the title. */
    lede?: string;
    /** Under the steps, for the person filling it in. */
    note?: string;
}

/** The fill-in and edit pages' side panel: where the record goes next. */
export default function AfterSubmit({
    process,
    names,
    schema,
    title = 'After you submit',
    lede = 'Where it goes next. You can follow it in My records.',
    note = 'You can change your answers until someone acts on it.',
}: AfterSubmitProps) {
    return (
        <section className="rd-panel" aria-labelledby="after-submit">
            <div className="rd-panel__head">
                <div>
                    <h2 id="after-submit" className="rd-panel__title">
                        {title}
                    </h2>
                    <p className="rd-panel__sub">{lede}</p>
                </div>
            </div>
            <ProcessSummary nodes={process.nodes ?? []} names={names} fields={schema.elements.filter(isField)} />
            {note && <p className="form-fill__aside-note">{note}</p>}
        </section>
    );
}
