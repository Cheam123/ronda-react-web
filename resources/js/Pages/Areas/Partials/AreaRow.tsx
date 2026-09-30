import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import TextInput from '@/Components/form/TextInput';
import Button from '@/Components/ui/Button';
import { confirm } from '@/lib/dialogs';
import type { IfeArea } from '@/types/catalogue';

/** One area, editable in place. Only an unused area can be deleted. */
export default function AreaRow({ area }: { area: IfeArea }) {
    const formId = `area-form-${area.id}`;
    const { data, setData, post, processing } = useForm({
        area: area.area,
        description: area.description ?? '',
    });

    const save = (event: FormEvent) => {
        event.preventDefault();
        post(route('area.update', area.id), { preserveScroll: true });
    };

    const remove = async () => {
        if (await confirm({ title: `Delete ${area.area}?`, danger: true })) {
            router.post(route('area.delete'), { id: area.id }, { preserveScroll: true });
        }
    };

    const unused = area.leads_count === 0 && area.reports_count === 0;

    return (
        <tr>
            <td colSpan={2}>
                <form id={formId} onSubmit={save} className="d-flex gap-2">
                    <TextInput
                        aria-label="Area name"
                        maxLength={30}
                        required
                        style={{ maxWidth: 190 }}
                        value={data.area}
                        onChange={(event) => setData('area', event.target.value)}
                    />
                    <TextInput
                        aria-label="Description"
                        maxLength={500}
                        value={data.description}
                        onChange={(event) => setData('description', event.target.value)}
                    />
                </form>
            </td>
            <td className="num">{area.leads_count}</td>
            <td className="num">{area.reports_count}</td>
            <td className="text-nowrap">
                <Button type="submit" form={formId} size="sm" className="me-1" loading={processing}>
                    Save
                </Button>
                {unused && (
                    <Button variant="danger" size="sm" onClick={remove}>
                        Delete
                    </Button>
                )}
            </td>
        </tr>
    );
}
