import { router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import TextInput from '@/Components/form/TextInput';
import { confirm } from '@/lib/dialogs';
import { areaHue } from '@/lib/tags';
import type { IfeArea } from '@/types/catalogue';

/** One area, editable in place, with its own errors. Only an unused area can be deleted. */
export default function AreaRow({ area }: { area: IfeArea }) {
    const formId = `area-form-${area.id}`;
    const { data, setData, post, processing, isDirty, errors } = useForm({
        area: area.area,
        description: area.description ?? '',
    });
    const nameError = `${formId}-area-error`;
    const descriptionError = `${formId}-description-error`;

    const save = (event: FormEvent) => {
        event.preventDefault();
        post(route('area.update', area.id), { preserveScroll: true });
    };

    const remove = async () => {
        if (
            await confirm({
                title: `Delete ${area.area}?`,
                text: 'It has no outlets or visits filed under it, so nothing else changes.',
                confirmText: 'Delete area',
                danger: true,
            })
        ) {
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
                        invalid={Boolean(errors.area)}
                        aria-describedby={errors.area ? nameError : undefined}
                        value={data.area}
                        onChange={(event) => setData('area', event.target.value)}
                    />
                    <TextInput
                        aria-label={`What ${area.area} covers`}
                        maxLength={500}
                        placeholder="What it covers"
                        invalid={Boolean(errors.description)}
                        aria-describedby={errors.description ? descriptionError : undefined}
                        value={data.description}
                        onChange={(event) => setData('description', event.target.value)}
                    />
                </form>
                {errors.area && (
                    <span className="rd-field__error area-row__error" id={nameError}>
                        <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                        {errors.area}
                    </span>
                )}
                {errors.description && (
                    <span className="rd-field__error area-row__error" id={descriptionError}>
                        <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
                        {errors.description}
                    </span>
                )}
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
