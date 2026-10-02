import { Link } from '@inertiajs/react';
import { useMemo } from 'react';
import FormRenderer from '@/Components/forms/FormRenderer';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { renderTree } from '@/lib/forms/schema';
import type { FormSchema, Person, ProcessDefinition } from '@/types/forms';
import AfterSubmit from './Partials/AfterSubmit';

interface PreviewProps {
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    process: ProcessDefinition;
    /** user id -> name, for everyone the process names. */
    processNames: Record<string, string>;
    people: Person[];
}

/** A form as the people filling it in see it, with its process. */
export default function Preview({ form, schema, process, processNames, people }: PreviewProps) {
    const tree = useMemo(() => renderTree(schema), [schema]);

    return (
        <AppLayout title={`Preview: ${form.name}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Forms', href: route('form.index') },
                        { label: form.name },
                    ]}
                    title={form.name}
                    lede={form.description}
                    meta={<span className="rd-chip rd-chip--blue">Preview</span>}
                    actions={
                        <Link href={route('form.edit', form.id)} className="rd-btn rd-btn--primary rd-btn--lg">
                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                            Edit form
                        </Link>
                    }
                />

                <div className="rd-form-page">
                    <div className="rd-form">
                        <p className="form-fill__note">
                            <i className="mdi mdi-eye-outline" aria-hidden="true" />
                            How people see it. Nothing here can be submitted, and fields with conditions all show.
                        </p>
                        {tree.length > 0 ? (
                            <FormRenderer items={tree} answers={{}} people={people} disabled />
                        ) : (
                            <p className="rd-list__empty">This form has no fields yet.</p>
                        )}
                    </div>
                    <aside className="rd-form-page__aside">
                        <AfterSubmit
                            process={process}
                            names={processNames}
                            schema={schema}
                            title="After someone submits"
                            lede="The steps every submission goes through."
                            note=""
                        />
                    </aside>
                </div>
            </SurfacePage>
        </AppLayout>
    );
}
