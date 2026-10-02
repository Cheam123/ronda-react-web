import { Link, router } from '@inertiajs/react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import BasicInfoStep, { type Access, type BasicInfo, type InfoProblem } from '@/Components/forms/builder/BasicInfoStep';
import DesignStep from '@/Components/forms/builder/DesignStep';
import ProcessStep from '@/Components/forms/builder/ProcessStep';
import { useFormDesign } from '@/Components/forms/builder/useFormDesign';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ErrorSummary from '@/Components/ui/ErrorSummary';
import AppLayout from '@/Layouts/AppLayout';
import { collectFields, collectSections, designFromSchema, serializeDesign, validateDesign } from '@/lib/forms/design';
import { collectProblems, serializeProcess } from '@/lib/forms/process';
import { pluralize } from '@/lib/format';
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

const STEPS: { step: Step; label: string; hint: string }[] = [
    { step: 1, label: 'Details', hint: 'Name, group and who can submit' },
    { step: 2, label: 'Fields', hint: 'What people fill in' },
    { step: 3, label: 'Process', hint: 'What happens after they submit' },
];

/** Make or change a form: its details, its fields, and the process after submitting. */
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

    const [infoInvalid, setInfoInvalid] = useState<InfoProblem[]>([]);
    // Nothing is marked until the user first tries to move on; after that the
    // marks follow the edits, so fixing a field clears it straight away.
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
                  access.user_ids.length && pluralize(access.user_ids.length, 'person', 'people'),
                  access.user_types.length && pluralize(access.user_types.length, 'user type'),
              ]
                  .filter(Boolean)
                  .join(' and ') || 'nobody yet'
            : 'Everyone';

    const checkInfo = () => {
        const bad: InfoProblem[] = (['name', 'description', 'form_group_id'] as const).filter(
            (key) => !info[key].trim(),
        );
        if (access.submit_scope === 'selected' && access.user_ids.length + access.user_types.length === 0) {
            bad.push('access');
        }
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
            ? problems.errors[0] + (problems.errors.length > 1 ? ` (and ${problems.errors.length - 1} more)` : '')
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
                // No `record` key: following up on an earlier record is chosen per submission.
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

    const saveLabel = form ? 'Save changes' : 'Create form';
    const notSaved = `nothing is saved until you ${form ? 'save the changes' : 'create the form'}`;
    const groupCount = sections.length;
    const requiredCount = fields.filter((field) => field.mandatory).length;
    const branchCount = nodes.filter((node) => node.type === 'branch').length;
    // Steps on every path count; a branch itself is not a step.
    const stepCount = nodes.reduce(
        (count, node) =>
            count + (node.type === 'branch' ? node.branches.reduce((inner, arm) => inner + arm.nodes.length, 0) : 1),
        0,
    );

    const nextButton = (
        <button type="button" className="rd-btn rd-btn--primary rd-btn--lg" onClick={() => go((step + 1) as Step)}>
            Next: {STEPS[step]?.label.toLowerCase()}
            <i className="mdi mdi-arrow-right" aria-hidden="true" />
        </button>
    );

    return (
        <AppLayout title={form ? `Edit ${form.name}` : 'New form'}>
            <SurfacePage className="form-builder">
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'Forms', href: route('form.index') },
                        { label: form ? form.name : 'New form' },
                    ]}
                    title={form ? `Edit ${form.name}` : 'New form'}
                />

                <nav className="form-steps" aria-label="Form builder steps">
                    {STEPS.map(({ step: target, label, hint }) => {
                        const done = target < step;
                        const current = target === step;
                        return (
                            <button
                                key={target}
                                type="button"
                                className={clsx('form-steps__step', current && 'is-current', done && 'is-done')}
                                aria-current={current ? 'step' : undefined}
                                onClick={() => go(target)}
                            >
                                <span className="form-steps__mark" aria-hidden="true">
                                    {done ? <i className="mdi mdi-check" /> : target}
                                </span>
                                <span className="form-steps__text">
                                    <span className="form-steps__label">{label}</span>
                                    <span className="form-steps__hint">{hint}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <ErrorSummary />

                {step === 1 && (
                    <BasicInfoStep
                        info={info}
                        onInfo={(patch) => {
                            setInfo((current) => ({ ...current, ...patch }));
                            setInfoInvalid((current) => current.filter((key) => !(key in patch)));
                        }}
                        access={access}
                        onAccess={(next) => {
                            setAccess(next);
                            setInfoInvalid((current) => current.filter((key) => key !== 'access'));
                        }}
                        groups={groups}
                        onGroupCreated={(group) => {
                            setGroups((current) => [...current, group]);
                            setInfo((current) => ({ ...current, form_group_id: String(group.id) }));
                            setInfoInvalid((current) => current.filter((key) => key !== 'form_group_id'));
                        }}
                        users={users}
                        types={types}
                        invalid={infoInvalid}
                        submitters={submitters}
                        fieldCount={fields.length}
                        stepCount={stepCount}
                        foot={
                            <div className="rd-form__foot">
                                <Link href={route('form.index')} className="rd-btn rd-btn--quiet rd-btn--lg">
                                    Cancel
                                </Link>
                                {nextButton}
                            </div>
                        }
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

                {step > 1 && (
                    <div className="form-builder__foot">
                        <span className="form-builder__tally">
                            {step === 2 ? (
                                <>
                                    <strong>{pluralize(fields.length, 'field')}</strong>
                                    {groupCount > 0 && ` in ${pluralize(groupCount, 'group')}`}
                                    {requiredCount > 0 && ` · ${requiredCount} required`}
                                </>
                            ) : (
                                <>
                                    <strong>{pluralize(stepCount, 'step')}</strong>
                                    {branchCount > 0 && ` with ${pluralize(branchCount, 'branch', 'branches')}`}
                                    {` · ${notSaved}`}
                                </>
                            )}
                        </span>
                        <span className="form-builder__buttons">
                            <button
                                type="button"
                                className="rd-btn rd-btn--lg"
                                onClick={() => setStep((step - 1) as Step)}
                            >
                                <i className="mdi mdi-arrow-left" aria-hidden="true" />
                                Back
                            </button>
                            {step < 3 ? (
                                nextButton
                            ) : (
                                <button
                                    type="button"
                                    className="rd-btn rd-btn--primary rd-btn--lg"
                                    disabled={saving}
                                    onClick={save}
                                >
                                    {saving && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                                    {saveLabel}
                                </button>
                            )}
                        </span>
                    </div>
                )}
            </SurfacePage>
        </AppLayout>
    );
}
