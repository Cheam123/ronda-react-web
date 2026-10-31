import { Link, router } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import { FormFoot, FormSection } from '@/Components/surface/FormSection';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import AppLayout from '@/Layouts/AppLayout';
import type { SelectOption } from '@/types';

interface ChooseOutletProps {
    /** The outlets this user can see; a prospect with a running task is disabled. */
    outlets: SelectOption<number>[];
}

/** "New task" from the task list or the dashboard: every task belongs to an outlet, so it is picked first. */
export default function ChooseOutlet({ outlets }: ChooseOutletProps) {
    const [outlet, setOutlet] = useState('');
    const [error, setError] = useState<string | undefined>();
    const someBlocked = outlets.some((option) => option.disabled);

    const next = (event: FormEvent) => {
        event.preventDefault();
        if (!outlet) {
            setError('Choose the outlet the task is for.');
            return;
        }
        router.get(route('tasks.create', { id: outlet }));
    };

    return (
        <AppLayout title="New task">
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Tasks', href: route('tasks.index2', { status: 'open' }) },
                        { label: 'New task' },
                    ]}
                    title="New task"
                    lede="Every task belongs to an outlet. Choose it, then fill in the task."
                />

                {outlets.length === 0 ? (
                    <p className="rd-notice">
                        <i className="mdi mdi-information-outline" aria-hidden="true" />
                        <span>
                            There are no outlets you can add a task to yet.{' '}
                            <Link href={route('lead.create')}>Add an outlet</Link> first.
                        </span>
                    </p>
                ) : (
                    <form className="rd-form rd-form--narrow" onSubmit={next} noValidate>
                        <FormSection title="Outlet" intro="Search by shop name, company or Customer ID.">
                            <Field
                                label="Outlet"
                                htmlFor="outlet"
                                required
                                error={error}
                                hint={
                                    someBlocked
                                        ? 'Greyed-out prospects already have a task running; a prospect has one at a time.'
                                        : undefined
                                }
                            >
                                <SearchSelect
                                    id="outlet"
                                    options={outlets}
                                    placeholder="Choose an outlet"
                                    clearable={false}
                                    value={outlet}
                                    onChange={(value) => {
                                        setOutlet(value);
                                        setError(undefined);
                                    }}
                                />
                            </Field>
                        </FormSection>
                        <FormFoot cancelHref={route('tasks.index2', { status: 'open' })} submitLabel="Continue" />
                    </form>
                )}
            </SurfacePage>
        </AppLayout>
    );
}
