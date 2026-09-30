import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import BasicInfoStep, { type Access, type BasicInfo } from '@/Components/forms/builder/BasicInfoStep';
import DesignStep from '@/Components/forms/builder/DesignStep';
import ProcessStep from '@/Components/forms/builder/ProcessStep';
import { useFormDesign } from '@/Components/forms/builder/useFormDesign';
import { ButtonLink } from '@/Components/ui/Button';
import Button from '@/Components/ui/Button';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { collectFields, collectSections, designFromSchema, serializeDesign, validateDesign } from '@/lib/forms/design';
import { collectProblems, serializeProcess } from '@/lib/forms/process';
import type { FormGroupOption, FormSchema, FormSettings, Person, ProcessDefinition, ProcessNode } from '@/types/forms';

interface BuilderProps {
    /** Null when creating a form. */
    form: {
        id: number;
        name: string;
        description: string | null;
        is_enabled: boolean;
        form_group_id: number | null;
    } | null;
    schema: FormSchema;
    process: ProcessDefinition;
    settings: FormSettings;
    users: Person[];
    /** User types for "who can submit". */
    types: Person[];
    groups: FormGroupOption[];
}

type Step = 1 | 2 | 3;

const STEPS: { step: Step; label: string }[] = [
    { step: 1, label: 'Basic Info' },
    { step: 2, label: 'Form Design' },
    { step: 3, label: 'Process Design' },
];

function pluralCount(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Create or edit a form: basic info, the fields, and the process after submission. */
export default function Builder({
    form,
    schema,
    process,
    settings,
    users,
    types,
    groups: initialGroups,
}: BuilderProps) {
    const [step, setStep] = useState<Step>(1);
    const [info, setInfo] = useState<BasicInfo>({
        name: form?.name ?? '',
        description: form?.description ?? '',
        is_enabled: form?.is_enabled ? '1' : '0',
        form_group_id: form?.form_group_id ? String(form.form_group_id) : '',
    });
    const [access, setAccess] = useState<Access>(() => {
        const saved = settings.access ?? { submit_scope: 'everyone', user_ids: [], user_types: [] };
        const count = (saved.user_ids ?? []).length + (saved.user_types ?? []).length;
        return {
            submit_scope: saved.submit_scope === 'selected' && count > 0 ? 'selected' : 'everyone',
            user_ids: (saved.user_ids ?? []).map(Number),
            user_types: (saved.user_types ?? []).map(Number),
        };
    });
    const [groups, setGroups] = useState(initialGroups);
    const builder = useFormDesign(useMemo(() => designFromSchema(schema), [schema]));
    const [nodes, setNodes] = useState<ProcessNode[]>(() => structuredClone(process.nodes ?? []));

    const [infoInvalid, setInfoInvalid] = useState<(keyof BasicInfo)[]>([]);
    // Nothing is marked until the user first tries to move on; after that the
    // marks follow the edits, so fixing a widget clears it straight away.
    const [designChecked, setDesignChecked] = useState(false);
    const [processChecks, setProcessChecks] = useState(0);
    const [saving, setSaving] = useState(false);

    const fields = collectFields(builder.design);
    const sections = collectSections(builder.design);
    const problems = collectProblems(nodes, fields);
    const designCheck = designChecked ? validateDesign(builder.design) : { invalid: [], message: null };

    const submitters =
        access.submit_scope === 'selected'
            ? [
                  access.user_ids.length && pluralCount(access.user_ids.length, 'member'),
                  access.user_types.length && pluralCount(access.user_types.length, 'user type'),
              ]
                  .filter(Boolean)
                  .join(', ') || 'No one selected'
            : 'All members';

    const checkInfo = () => {
        const bad = (['name', 'description', 'form_group_id'] as const).filter((key) => !info[key].trim());
        setInfoInvalid(bad);
        return bad.length === 0;
    };

    const checkDesign = () => {
        const found = validateDesign(builder.design);
        setDesignChecked(true);
        if (found.invalid.length > 0) {
            const first = found.invalid[0];
            builder.select({ kind: builder.design.sections[first] ? 'group' : 'element', id: first });
        }
        return found.message === null;
    };

    const checkStep = (current: Step) => (current === 1 ? checkInfo() : current === 2 ? checkDesign() : true);

    const go = (target: Step) => {
        // Going back is always allowed; going on needs this step to be complete.
        if (target < step || checkStep(step)) setStep(target);
    };

    const processError =
        processChecks > 0 && problems.errors.length > 0
            ? problems.errors[0] + (problems.errors.length > 1 ? ` (+${problems.errors.length - 1} more)` : '')
            : null;

    const save = () => {
        if (!checkInfo()) return setStep(1);
        if (!checkDesign()) return setStep(2);
        setProcessChecks((count) => count + 1);
        if (problems.errors.length > 0) return setStep(3);

        router.post(
            form ? route('form.update', form.id) : route('form.store'),
            {
                ...info,
                form_elements: JSON.stringify(serializeDesign(builder.design)),
                // No `record` key: following up on an earlier case is chosen per submission.
                settings: JSON.stringify({ access }),
                process_definition: JSON.stringify(serializeProcess(nodes)),
            },
            {
                preserveState: 'errors',
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <AppLayout
            title={form ? 'Edit Form' : 'Form Creation'}
            breadcrumb={['Form List', form ? form.name : 'New form']}
        >
            <div className="page-title-box d-flex align-items-center">
                <ButtonLink
                    href={route('form.index')}
                    variant="secondary"
                    size="sm"
                    className="me-3"
                    icon="mdi mdi-arrow-left"
                >
                    Back
                </ButtonLink>
                <h4 className="mb-0">{form ? 'Edit Form' : 'Create Form'}</h4>
            </div>

            <div className="card">
                <div className="card-body py-3">
                    <ul className="nav nav-pills nav-justified">
                        {STEPS.map(({ step: target, label }) => (
                            <li key={target} className="nav-item">
                                <button
                                    type="button"
                                    className={clsx('nav-link wizard-pill', step === target && 'active')}
                                    onClick={() => go(target)}
                                >
                                    <span className="badge rounded-pill bg-light text-dark me-1">{target}</span> {label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <ErrorSummary />

            {step === 1 && (
                <BasicInfoStep
                    info={info}
                    onInfo={(patch) => {
                        setInfo((current) => ({ ...current, ...patch }));
                        setInfoInvalid((current) => current.filter((key) => !(key in patch)));
                    }}
                    access={access}
                    onAccess={setAccess}
                    groups={groups}
                    onGroupCreated={(group) => {
                        setGroups((current) => [...current, group]);
                        setInfo((current) => ({ ...current, form_group_id: String(group.id) }));
                        setInfoInvalid((current) => current.filter((key) => key !== 'form_group_id'));
                    }}
                    users={users}
                    types={types}
                    invalid={infoInvalid}
                />
            )}

            {step === 2 && (
                <DesignStep
                    builder={builder}
                    formName={info.name}
                    people={users}
                    invalid={designCheck.invalid}
                    error={designCheck.message}
                />
            )}

            {step === 3 && (
                <ProcessStep
                    nodes={nodes}
                    onChange={setNodes}
                    fields={fields}
                    sections={sections}
                    people={users}
                    submitters={submitters}
                    badNodes={processChecks > 0 ? problems.badNodes : {}}
                    error={processError}
                    checkCount={processChecks}
                />
            )}

            <div className="text-center my-4">
                <Button variant="warning" className="me-2" onClick={() => window.history.back()}>
                    Cancel
                </Button>
                {step > 1 && (
                    <Button
                        variant="secondary"
                        className="me-2"
                        icon="mdi mdi-arrow-left"
                        onClick={() => setStep((step - 1) as Step)}
                    >
                        Back
                    </Button>
                )}
                {step < 3 ? (
                    <Button className="me-2" onClick={() => go((step + 1) as Step)}>
                        Next <i className="mdi mdi-arrow-right ms-1" />
                    </Button>
                ) : (
                    <Button variant="success" loading={saving} onClick={save}>
                        {form ? 'Save Changes' : 'Create Form'}
                    </Button>
                )}
            </div>
        </AppLayout>
    );
}
