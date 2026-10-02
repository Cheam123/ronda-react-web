import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import Field from '@/Components/form/Field';
import TextInput from '@/Components/form/TextInput';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { pluralize } from '@/lib/format';
import type { IfeArea } from '@/types/catalogue';
import AreaRow from './Partials/AreaRow';

/** IFE areas, the territories leads and visit reports are filed under. */
export default function AreasIndex({ areas }: { areas: IfeArea[] }) {
    const { data, setData, post, processing, reset, errors } = useForm({ area: '', description: '' });

    const add = (event: FormEvent) => {
        event.preventDefault();
        post(route('area.store'), { preserveScroll: true, onSuccess: () => reset() });
    };

    return (
        <AppLayout title="IFE areas">
            <SurfacePage>
                <PageHeader
                    crumbs={[{ label: 'Admin' }, { label: 'IFE areas' }]}
                    title="IFE areas"
                    lede="The territories outlets and visit reports are filed under. An area with no outlets or visits can be deleted."
                />

                <ErrorSummary />

                <section className="rd-panel" aria-labelledby="add-area-title">
                    <h2 id="add-area-title" className="rd-panel__title">
                        Add an area
                    </h2>
                    <form onSubmit={add} className="area-add" noValidate>
                        <Field label="Name" htmlFor="area" required error={errors.area}>
                            <TextInput
                                id="area"
                                large
                                maxLength={30}
                                required
                                invalid={Boolean(errors.area)}
                                value={data.area}
                                onChange={(event) => setData('area', event.target.value)}
                            />
                        </Field>
                        <Field label="What it covers" htmlFor="description" error={errors.description}>
                            <TextInput
                                id="description"
                                large
                                maxLength={500}
                                placeholder="Districts, towns or malls"
                                value={data.description}
                                onChange={(event) => setData('description', event.target.value)}
                            />
                        </Field>
                        <button type="submit" className="rd-btn rd-btn--primary rd-btn--lg" disabled={processing}>
                            <i className="mdi mdi-plus" aria-hidden="true" />
                            Add area
                        </button>
                    </form>
                </section>

                <section className="rd-panel rd-panel--flush rd-list rd-list--flush" aria-labelledby="areas-title">
                    <div className="rd-list__head">
                        <div className="rd-list__heading">
                            <h2 id="areas-title" className="rd-list__title">
                                All areas
                            </h2>
                            <span className="rd-count rd-count--label">{pluralize(areas.length, 'area')}</span>
                        </div>
                    </div>
                    <div className="rd-scroll">
                        <table className="rd-table rd-table--flush area-table">
                            <thead>
                                <tr>
                                    <th scope="col">Area and what it covers</th>
                                    <th scope="col" className="num">
                                        Outlets
                                    </th>
                                    <th scope="col" className="num">
                                        Visits
                                    </th>
                                    <th scope="col" className="rd-col-actions">
                                        <span className="visually-hidden">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {areas.map((area) => (
                                    <AreaRow key={area.id} area={area} />
                                ))}
                                {areas.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="rd-list__empty">
                                            No areas yet. Add the first one above.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </SurfacePage>
        </AppLayout>
    );
}
