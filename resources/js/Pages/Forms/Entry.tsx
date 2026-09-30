import { Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import TextInput from '@/Components/form/TextInput';
import { ButtonLink } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import { truncate } from '@/lib/format';
import type { FormSummary } from '@/types/forms';

interface FormsEntryProps {
    /** Grouped when an admin has made groups; one unnamed section otherwise. */
    sections: { name: string | null; forms: FormSummary[] }[];
}

/** "Available Forms": every form the user may submit, to start one. */
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
        <AppLayout title="Available Forms" breadcrumb={['Forms']}>
            <div className="page-title-box d-flex align-items-center justify-content-between">
                <h4 className="mb-0">Available Forms</h4>
                <ButtonLink
                    href={route('form.records.index')}
                    variant="outline-primary"
                    icon="mdi mdi-clipboard-list-outline"
                >
                    My Records
                </ButtonLink>
            </div>

            <div className="row mb-3">
                <div className="col-md-5">
                    <div className="input-group">
                        <span className="input-group-text">
                            <i className="mdi mdi-magnify" />
                        </span>
                        <TextInput
                            large
                            placeholder="Search forms..."
                            aria-label="Search forms"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                    {term && (
                        <small className="text-muted ms-1 mt-1 d-block">
                            {total} form{total === 1 ? '' : 's'} found
                        </small>
                    )}
                </div>
            </div>

            {shown.map((section) => (
                <div key={section.name ?? 'forms'} className="form-entry-section mb-2">
                    {section.name && (
                        <div className="form-entry-section__head">
                            <h6>{section.name}</h6>
                            <div className="form-entry-section__rule" />
                            <small className="text-muted">{section.forms.length}</small>
                        </div>
                    )}
                    <div className="row">
                        {section.forms.map((form) => (
                            <div key={form.id} className="col-md-4 mb-4">
                                <div className="card h-100 mb-0 form-entry-card">
                                    <div className="card-body d-flex flex-column">
                                        <h6 className="fw-bold mb-1">{form.name}</h6>
                                        <p className="text-muted mb-3 flex-grow-1 small">
                                            {truncate(form.description, 80)}
                                        </p>
                                        <div className="d-flex justify-content-between align-items-center mt-auto">
                                            <small className="text-muted">
                                                <i className="mdi mdi-format-list-bulleted" /> {form.field_count}{' '}
                                                field(s)
                                            </small>
                                            <Link href={route('form.fill', form.id)} className="btn btn-primary btn-sm">
                                                Start
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {shown.length === 0 && (
                <div className="card form-entry-card">
                    <div className="card-body text-center py-5">
                        <i className={`mdi ${hasForms ? 'mdi-magnify' : 'mdi-file-document-outline'} empty-icon`} />
                        <h5 className="mt-3 text-muted">{hasForms ? 'No Forms Found' : 'No Forms Available'}</h5>
                        <p className="text-muted mb-0">
                            {hasForms
                                ? 'No forms match your search criteria.'
                                : 'There are no forms you can submit right now.'}
                        </p>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
