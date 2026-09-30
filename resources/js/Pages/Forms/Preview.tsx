import { useMemo } from 'react';
import FormRenderer from '@/Components/forms/FormRenderer';
import { ButtonLink } from '@/Components/ui/Button';
import AppLayout from '@/Layouts/AppLayout';
import { renderTree } from '@/lib/forms/schema';
import type { FormSchema, Person, ProcessDefinition, ProcessNode } from '@/types/forms';

interface PreviewProps {
    form: { id: number; name: string; description: string | null };
    schema: FormSchema;
    process: ProcessDefinition;
    /** user id -> name, for everyone the process names. */
    approverNames: Record<string, string>;
    people: Person[];
}

function ProcessStep({ node, names }: { node: ProcessNode; names: (ids: number[]) => string }) {
    switch (node.type) {
        case 'approval':
            return (
                <div className="process-preview process-preview--approval">
                    <div className="fw-semibold small">
                        <i className="mdi mdi-account-check-outline me-1" />
                        {node.name || 'Approval'}
                    </div>
                    <div className="small text-muted">{names(node.approver_ids)}</div>
                    <div className="small text-muted fst-italic">
                        {node.approval_mode === 'all' ? 'Everyone must approve' : 'Any one approver'}
                    </div>
                </div>
            );
        case 'fill':
            return (
                <div className="process-preview process-preview--fill">
                    <div className="fw-semibold small">
                        <i className="mdi mdi-account-edit-outline me-1" />
                        {node.name || 'Handler'}
                    </div>
                    <div className="small text-muted">
                        Handler:{' '}
                        {node.assignee_mode === 'runtime' ? (
                            <span className="fst-italic">picked when the flow reaches this step</span>
                        ) : node.assignee_mode === 'field' ? (
                            <span className="fst-italic">whoever is chosen in the form</span>
                        ) : (
                            names(node.assignee_ids)
                        )}
                    </div>
                    <div className="small text-muted fst-italic">Fills their section of the form</div>
                </div>
            );
        case 'cc':
            return (
                <div className="process-preview process-preview--cc">
                    <div className="fw-semibold small">
                        <i className="mdi mdi-email-outline me-1" />
                        {node.name || 'Notify'}
                    </div>
                    <div className="small text-muted">{names(node.user_ids)}</div>
                </div>
            );
        case 'branch':
            return (
                <div className="process-preview process-preview--branch">
                    <div className="fw-semibold small mb-1">
                        <i className="mdi mdi-source-branch me-1" />
                        Conditional branch
                    </div>
                    {node.branches.map((branch) => (
                        <div key={branch.id} className="border rounded p-2 mb-1 bg-white">
                            <div className="small fw-semibold">{branch.when ? branch.name || 'Branch' : 'Else'}</div>
                            {branch.nodes.length === 0 ? (
                                <div className="small text-muted fst-italic">No steps — continues directly.</div>
                            ) : (
                                branch.nodes.map((child) => <ProcessStep key={child.id} node={child} names={names} />)
                            )}
                        </div>
                    ))}
                </div>
            );
        default:
            return null;
    }
}

/** A form as its users will see it, with its approval process. */
export default function Preview({ form, schema, process, approverNames, people }: PreviewProps) {
    const tree = useMemo(() => renderTree(schema), [schema]);
    const names = (ids: number[] = []) => ids.map((id) => approverNames[String(id)] ?? `User #${id}`).join(', ');

    return (
        <AppLayout title="Form Preview" breadcrumb={['Form List', form.name]}>
            <div className="page-title-box d-flex align-items-center justify-content-between">
                <h4 className="mb-0">Form Preview: {form.name}</h4>
                <ButtonLink href={route('form.index')} variant="secondary" icon="mdi mdi-arrow-left">
                    Back to List
                </ButtonLink>
            </div>

            <div className="row">
                <div className="col-lg-8">
                    <div className="card">
                        <div className="card-body">
                            <h5 className="card-title">{form.name}</h5>
                            <p className="text-muted">{form.description}</p>
                            <hr />
                            {tree.length > 0 ? (
                                <>
                                    <FormRenderer items={tree} answers={{}} people={people} disabled />
                                    <div className="alert alert-warning mt-4">
                                        <i className="mdi mdi-information-outline" /> This is a preview only. The form
                                        is not functional. Fields with display conditions are all shown here regardless
                                        of their conditions.
                                    </div>
                                </>
                            ) : (
                                <div className="alert alert-info">
                                    <i className="mdi mdi-information-outline" /> No form elements have been added to
                                    this form yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card">
                        <div className="card-body">
                            <h5 className="card-title mb-3">
                                <i className="mdi mdi-sitemap me-1" />
                                Approval Process
                            </h5>
                            {process.nodes.length === 0 ? (
                                <div className="text-muted small">
                                    No approval steps — submissions are approved automatically.
                                </div>
                            ) : (
                                <>
                                    <div className="text-center mb-2">
                                        <span className="badge bg-dark px-3 py-2">Submit</span>
                                    </div>
                                    {process.nodes.map((node) => (
                                        <ProcessStep key={node.id} node={node} names={names} />
                                    ))}
                                    <div className="text-center mt-2">
                                        <span className="badge bg-dark px-3 py-2">End</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
