import { Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import { pluralize } from '@/lib/format';
import type { FormSummary } from '@/types/forms';

interface FormsEntryProps {
    /** Grouped when an admin has made groups; one unnamed section otherwise. */
    sections: { name: string | null; forms: FormSummary[] }[];
}

/** "Start a form": every form the user may submit, to start one. */
export default function FormsEntry({ sections }: FormsEntryProps) {
    const [query, setQuery] = useState('');
    const term = query.trim().toLowerCase();

    const shown = useMemo(
        () =>
            sections
                .map((section) => ({
                    ...section,
                    forms: section.forms.filter(
                        (form) =>
                            !term ||
                            form.name.toLowerCase().includes(term) ||
                            (form.description ?? '').toLowerCase().includes(term),
                    ),
                }))
                .filter((section) => section.forms.length > 0),
        [sections, term],
    );
    const total = shown.reduce((count, section) => count + section.forms.length, 0);
    const hasForms = sections.some((section) => section.forms.length > 0);

    return (
        <AppLayout title="Start a form">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Home', href: '/index' }, { label: 'Start a form' }]}
                    title="Start a form"
                    lede="The forms you can fill in. What you submit shows in My records."
                    actions={
                        <>
                            {hasForms && (
                                <label className="rd-search form-start__search">
                                    <i className="mdi mdi-magnify" aria-hidden="true" />
                                    <input
                                        type="search"
                                        className="rd-input"
                                        aria-label="Search forms"
                                        placeholder="Search forms"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                    />
                                </label>
                            )}
                            <Link href={route('form.records.index')} className="rd-btn rd-btn--lg">
                                <i className="mdi mdi-clipboard-text-outline" aria-hidden="true" />
                                My records
                            </Link>
                        </>
                    }
                />

                {term && hasForms && (
                    <p className="form-start__found" role="status">
                        {total === 0 ? 'No forms match.' : `${pluralize(total, 'form')} found`}
                    </p>
                )}

                {shown.map((section) => (
                    <section key={section.name ?? 'forms'} className="form-start" aria-label={section.name ?? 'Forms'}>
                        {section.name && (
                            <div className="form-start__head">
                                <h2>{section.name}</h2>
                                <span className="rd-count">{section.forms.length}</span>
                            </div>
                        )}
                        <div className="form-start__grid">
                            {section.forms.map((form) => (
                                <Link key={form.id} href={route('form.fill', form.id)} className="form-card">
                                    <span className="form-card__icon" aria-hidden="true">
                                        <i className="mdi mdi-file-document-outline" />
                                    </span>
                                    <span className="form-card__text">
                                        <span className="form-card__name">{form.name}</span>
                                        {form.description && (
                                            <span className="form-card__desc">{form.description}</span>
                                        )}
                                    </span>
                                    <span className="form-card__foot">
                                        <span className="rd-muted">{pluralize(form.field_count, 'field')}</span>
                                        <span className="form-card__start">
                                            Start
                                            <i className="mdi mdi-arrow-right" aria-hidden="true" />
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))}

                {!hasForms && (
                    <section className="rd-panel form-start__empty">
                        <span className="rd-icon rd-icon--lg rd-icon--neutral">
                            <i className="mdi mdi-file-document-outline" aria-hidden="true" />
                        </span>
                        <p>There are no forms you can fill in right now.</p>
                    </section>
                )}
            </SurfacePage>
        </AppLayout>
    );
}
