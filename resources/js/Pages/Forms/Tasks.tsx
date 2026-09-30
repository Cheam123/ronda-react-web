import { Link } from '@inertiajs/react';
import DataTable from '@/Components/ui/DataTable';
import AppLayout from '@/Layouts/AppLayout';

interface FormTask {
    submission_id: number;
    record_id: number;
    record_title: string;
    record_ref: string;
    form_name: string;
    submitted_by: string;
    submitted_at: string | null;
    submitted_ago: string | null;
    stage_name: string | null;
    stage_type: 'fill' | 'approval' | string | null;
}

/** Form Tasks: sections to fill and approvals waiting on the signed-in user. */
export default function FormTasks({ tasks }: { tasks: FormTask[] }) {
    return (
        <AppLayout title="Form Tasks" breadcrumb={['Form Tasks']}>
            <div className="page-title-box">
                <h4 className="mb-0">Form Tasks</h4>
            </div>

            <div className="card">
                <div className="card-body">
                    <p className="text-muted mb-4">
                        Forms waiting for <strong>your</strong> action — sections assigned to you and approvals on your
                        desk.
                    </p>

                    {tasks.length === 0 ? (
                        <div className="text-center text-muted py-5">
                            <i className="mdi mdi-check-all display-4 empty-icon" />
                            <p className="mt-2 mb-0">All caught up — nothing is waiting on you.</p>
                        </div>
                    ) : (
                        <DataTable className="table-hover align-middle mb-0" nowrap={false}>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Record</th>
                                    <th>Submitted By</th>
                                    <th>Submitted At</th>
                                    <th>Waiting For</th>
                                    <th className="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task, index) => {
                                    const fill = task.stage_type === 'fill';
                                    const href = route('form.records.show', task.record_id);
                                    return (
                                        <tr key={task.submission_id}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <Link href={href} className="fw-semibold text-body d-block">
                                                    {task.record_title}
                                                </Link>
                                                <div className="text-muted small">
                                                    {task.form_name} &middot;{' '}
                                                    <span className="badge bg-light text-dark border">
                                                        {task.record_ref}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>{task.submitted_by}</td>
                                            <td>
                                                {task.submitted_at}
                                                <div className="text-muted small">{task.submitted_ago}</div>
                                            </td>
                                            <td>
                                                <span
                                                    className={`badge ${fill ? 'stage-badge--fill' : 'stage-badge--approval'}`}
                                                >
                                                    <i
                                                        className={`mdi ${fill ? 'mdi-account-edit-outline' : 'mdi-account-check-outline'} me-1`}
                                                    />
                                                    {fill ? 'Handler' : 'Approve'}: {task.stage_name}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <Link href={href} className="btn btn-sm btn-primary">
                                                    {fill ? 'Fill Section' : 'Review'}
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </DataTable>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
