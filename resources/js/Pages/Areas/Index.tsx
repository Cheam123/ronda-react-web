import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import Card from '@/Components/ui/Card';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';
import type { IfeArea } from '@/types/catalogue';
import AreaRow from './Partials/AreaRow';

interface AreasIndexProps extends BreadcrumbProps {
    areas: IfeArea[];
}

/** IFE areas, the territories leads and visit reports are filed under. */
export default function AreasIndex({ areas, ...breadcrumb }: AreasIndexProps) {
    const { data, setData, post, processing, reset } = useForm({ area: '', description: '' });

    const add = (event: FormEvent) => {
        event.preventDefault();
        post(route('area.store'), { preserveScroll: true, onSuccess: () => reset() });
    };

    return (
        <AppLayout title="IFE Areas" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card>
                <ErrorSummary />

                <SectionHeader title="Add Area" />
                <form onSubmit={add} className="row g-2 m-1 mb-3">
                    <div className="col-md-3">
                        <TextInput
                            aria-label="Area name"
                            placeholder="Area name"
                            maxLength={30}
                            required
                            value={data.area}
                            onChange={(event) => setData('area', event.target.value)}
                        />
                    </div>
                    <div className="col-md-7">
                        <TextInput
                            aria-label="Description"
                            placeholder="Description (optional)"
                            maxLength={500}
                            value={data.description}
                            onChange={(event) => setData('description', event.target.value)}
                        />
                    </div>
                    <div className="col-md-2">
                        <Button type="submit" size="sm" className="w-100" loading={processing}>
                            Add
                        </Button>
                    </div>
                </form>

                <DataTable nowrap={false}>
                    <thead>
                        <tr>
                            <th style={{ width: 200 }}>Area</th>
                            <th>Description</th>
                            <th className="num" style={{ width: 80 }}>
                                Leads
                            </th>
                            <th className="num" style={{ width: 80 }}>
                                Visits
                            </th>
                            <th style={{ width: 170 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {areas.map((area) => (
                            <AreaRow key={area.id} area={area} />
                        ))}
                        {areas.length === 0 && <EmptyRow colSpan={5}>No areas yet. Add the first one above.</EmptyRow>}
                    </tbody>
                </DataTable>
            </Card>
        </AppLayout>
    );
}
