import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import TextInput from '@/Components/form/TextInput';
import { confirm } from '@/lib/dialogs';
import { areaHue } from '@/lib/tags';
import type { IfeArea } from '@/types/catalogue';

/** One area, editable in place. Only an unused area can be deleted. */
export default function AreaRow({ area }: { area: IfeArea }) {
    const formId = `area-form-${area.id}`;
    const { data, setData, post, processing, isDirty } = useForm({
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
            <td>
                <form id={formId} onSubmit={save} className="area-row__fields">
                    <span className={`area-row__swatch rd-tag--${areaHue(area.id)}`} aria-hidden="true" />
                    <TextInput
                        aria-label={`Name of ${area.area}`}
                        maxLength={30}
                        required
                        className="area-row__name"
                        value={data.area}
                        onChange={(event) => setData('area', event.target.value)}
                    />
                    <TextInput
                        aria-label={`What ${area.area} covers`}
                        maxLength={500}
                        placeholder="What it covers"
                        value={data.description}
                        onChange={(event) => setData('description', event.target.value)}
                    />
                </form>
            </td>
            <td className="num">{area.leads_count}</td>
            <td className="num">{area.reports_count}</td>
            <td className="rd-col-actions">
                <div className="rd-actions">
                    <button type="submit" form={formId} className="rd-btn" disabled={processing || !isDirty}>
                        Save
                    </button>
                    {unused ? (
                        <button
                            type="button"
                            className="rd-btn rd-btn--icon rd-btn--icon-danger"
                            aria-label={`Delete ${area.area}`}
                            title="Delete"
                            onClick={remove}
                        >
                            <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                        </button>
                    ) : (
                        <span className="area-row__keep" title="Outlets or visits are filed under it" />
                    )}
                </div>
            </td>
        </tr>
    );
}
