import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AssigneePicker from '@/Components/forms/AssigneePicker';
import { ResponseSections, type ResponseSectionData } from '@/Components/forms/ResponseField';
import StatusBadge from '@/Components/forms/StatusBadge';
import Button from '@/Components/ui/Button';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { pluralize } from '@/lib/format';
import type { CaseLink, FormSchema, Person } from '@/types/forms';
import FillStageCard from './Partials/record/FillStageCard';
import PreviousRoundsCard from './Partials/record/PreviousRoundsCard';
import RecordActionModal from './Partials/record/RecordActionModal';
import ReviewTimeline from './Partials/record/ReviewTimeline';
import type { FillStage, PreviousRound, RecordTimeline } from './Partials/record/types';

interface RecordPageProps {
    record: {
        id: number;
        reference: string;
        title: string;
        status: string;
        open: boolean;
        form: { id: number; name: string; description: string | null };
        submitted_by: string;
        submitted_at: string;
        closed: { remark: string | null; by: string; at: string | null } | null;
    };
    parentCase: CaseLink | null;
    childCases: CaseLink[];
    canFollowUp: boolean;
    canClose: boolean;
    responses: { sections: ResponseSectionData[]; fieldCount: number; sectionCount: number };
    previousRounds: PreviousRound[];
    timeline: RecordTimeline;
    review: { canApprove: boolean; waitingFor: string[]; stageName: string | null; nextStage: string | null };
    fillStage: FillStage | null;
    schema: FormSchema;
    entry: { canEdit: boolean; canCancel: boolean; canClone: boolean };
    people: Person[];
}

const STATUS_PILLS: Record<string, { label: string; tone: string }> = {
    pending: { label: 'In Review', tone: 'pending' },
    approved: { label: 'Approved', tone: 'approved' },
    rejected: { label: 'Rejected', tone: 'rejected' },
    cancelled: { label: 'Cancelled', tone: 'cancelled' },
};

type Dialog = 'approve' | 'reject' | 'close' | 'cancel' | null;

/** One case: its answers, progress, the viewer's part in it, and related cases. */
export default function RecordPage({
    record,
    parentCase,
    childCases,
    canFollowUp,
    canClose,
    responses,
    previousRounds,
    timeline,
    review,
    fillStage,
    schema,
    entry,
    people,
}: RecordPageProps) {
    const [dialog, setDialog] = useState<Dialog>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const status = STATUS_PILLS[record.status] ?? STATUS_PILLS.pending;
    const waitingText =
        review.waitingFor.length > 1
            ? `${review.waitingFor.slice(0, -1).join(', ')} and ${review.waitingFor[review.waitingFor.length - 1]}`
            : review.waitingFor[0];
    const hasEntryActions = entry.canEdit || entry.canCancel || entry.canClone;

    return (
        <AppLayout title="Review Submission" breadcrumb={['Records', record.reference]}>
            <div className="rs-page">
                <div className="rs-topbar">
                    <div>
                        <Link href={route('form.records.index')} className="rs-back">
                            <i className="mdi mdi-arrow-left" /> Back to records
                        </Link>
                        <div className="rs-title-row">
                            <h1 className="rs-title">{record.title}</h1>
                            <span className="rs-id-badge">{record.reference}</span>
                            <span className={`rs-status-pill rs-status-pill--${status.tone}`}>
                                <span className="rs-status-dot" />
                                {status.label}
                            </span>
                            {!record.open && (
                                <span className="rs-status-pill rs-status-pill--cancelled">Record closed</span>
                            )}
                        </div>
                        <div className="rs-form-desc">
                            {record.form.name}
                            {record.form.description && <> &middot; {record.form.description}</>}
                        </div>
                        {parentCase && (
                            <div className="rs-form-desc mt-1">
                                <i className="mdi mdi-subdirectory-arrow-right me-1" />
                                Follows up on{' '}
                                <Link href={route('form.records.show', parentCase.id)} className="fw-semibold">
                                    {parentCase.reference} — {parentCase.title}
                                </Link>
                            </div>
                        )}
                    </div>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        {canFollowUp && (
                            <Link
                                href={route('form.fill', { id: record.form.id, parent: record.id })}
                                className="btn btn-primary"
                            >
                                <i className="mdi mdi-plus me-1" /> Start follow-up case
                            </Link>
                        )}
                        {canClose &&
                            (record.open ? (
                                <Button
                                    variant="outline-secondary"
                                    shadow={false}
                                    icon="mdi mdi-lock-outline"
                                    onClick={() => setDialog('close')}
                                >
                                    Close
                                </Button>
                            ) : (
                                <Button
                                    variant="outline-secondary"
                                    shadow={false}
                                    icon="mdi mdi-lock-open-variant-outline"
                                    onClick={() => router.post(route('form.records.reopen', record.id))}
                                >
                                    Reopen
                                </Button>
                            ))}
                        <div className="rs-submitter">
                            <div className="rs-avatar">{record.submitted_by.charAt(0).toUpperCase()}</div>
                            <div>
                                <div className="rs-submitter-name">{record.submitted_by}</div>
                                <div className="rs-submitter-date">Submitted {record.submitted_at}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {record.closed && (
                    <div className="rs-closed-card">
                        <div className="rs-closed-head">
                            <i className="mdi mdi-lock-outline" />
                            This record is closed
                        </div>
                        {record.closed.remark && <div className="rs-closed-remark">{record.closed.remark}</div>}
                        {record.closed.at && (
                            <div className="rs-closed-meta">
                                Closed by {record.closed.by} on {record.closed.at}.
                            </div>
                        )}
                    </div>
                )}

                {childCases.length > 0 && (
                    <div className="rs-card mb-3">
                        <div className="rs-card-head">
                            <div className="rs-card-title">Follow-up cases</div>
                            <span className="rs-card-meta">{childCases.length} opened from this one</span>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <tbody>
                                    {childCases.map((child) => (
                                        <tr key={child.id}>
                                            <td className="text-muted small fw-semibold">{child.reference}</td>
                                            <td>
                                                {child.title}
                                                <div className="text-muted small">
                                                    {child.created_at} &middot; {child.submitted_by}
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <StatusBadge status={child.status} />
                                            </td>
                                            <td className="text-center">
                                                <Link
                                                    href={route('form.records.show', child.id)}
                                                    className="btn btn-sm btn-outline-primary"
                                                >
                                                    Open
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="rs-grid">
                    <div className="rs-left">
                        <div className="rs-card">
                            <div className="rs-card-head">
                                <div className="rs-card-title">Responses</div>
                                <div className="rs-card-meta">
                                    {pluralize(responses.fieldCount, 'field')}
                                    {responses.sectionCount > 0 && ` · ${pluralize(responses.sectionCount, 'section')}`}
                                </div>
                            </div>
                            <div className="rs-card-body">
                                {responses.sections.length > 0 ? (
                                    <ResponseSections sections={responses.sections} onImageClick={setPhoto} />
                                ) : (
                                    <div className="rs-empty">
                                        <i className="mdi mdi-file-document-outline" />
                                        <p className="mb-0">No field data visible for this submission.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Read before the work starts. */}
                        <PreviousRoundsCard rounds={previousRounds} onImageClick={setPhoto} />

                        {fillStage && (
                            <FillStageCard
                                recordId={record.id}
                                stage={fillStage}
                                schema={schema}
                                people={people}
                                onImageClick={setPhoto}
                            />
                        )}
                    </div>

                    <div className="rs-right">
                        <div className="rs-card rs-sidebar-card">
                            <div className="rs-sidebar-title">Approval Progress</div>
                            <ReviewTimeline
                                timeline={timeline}
                                submittedBy={record.submitted_by}
                                canAct={review.canApprove || fillStage !== null}
                                waitingFor={review.waitingFor}
                            />
                        </div>

                        {review.canApprove ? (
                            <div className="rs-card rs-sidebar-card">
                                <div className="rs-sidebar-title">{review.stageName ?? 'Actions'}</div>
                                <div className="rs-actions">
                                    <Button
                                        variant="success"
                                        shadow={false}
                                        className="w-100"
                                        icon="mdi mdi-check-circle-outline"
                                        onClick={() => setDialog('approve')}
                                    >
                                        Approve Submission
                                    </Button>
                                    <Button
                                        variant="outline-danger"
                                        shadow={false}
                                        className="w-100"
                                        icon="mdi mdi-close-circle-outline"
                                        onClick={() => setDialog('reject')}
                                    >
                                        Reject Submission
                                    </Button>
                                </div>
                                <div className="rs-actions-help">
                                    {review.nextStage ? (
                                        <>
                                            Approving advances the submission to <strong>{review.nextStage}</strong>.
                                        </>
                                    ) : (
                                        'Approving completes the approval process.'
                                    )}
                                </div>
                            </div>
                        ) : (
                            review.waitingFor.length > 0 && (
                                <div className="rs-waiting-card">
                                    <strong>Waiting on this stage.</strong>{' '}
                                    <span>
                                        {waitingText} still {review.waitingFor.length > 1 ? 'need' : 'needs'} to act
                                        before you can review.
                                    </span>
                                </div>
                            )
                        )}

                        {hasEntryActions && (
                            <div className="rs-card rs-sidebar-card">
                                <div className="rs-sidebar-title">This entry</div>
                                <div className="rs-actions">
                                    {entry.canEdit && (
                                        <Link
                                            href={route('form.submission.edit', record.id)}
                                            className="btn btn-outline-primary w-100"
                                        >
                                            <i className="mdi mdi-pencil-outline me-1" />
                                            Edit answers
                                        </Link>
                                    )}
                                    {entry.canClone && (
                                        <Link
                                            href={route('form.submission.clone', record.id)}
                                            className="btn btn-outline-secondary w-100"
                                        >
                                            <i className="mdi mdi-content-copy me-1" />
                                            Start a new record from this
                                        </Link>
                                    )}
                                    {entry.canCancel && (
                                        <Button
                                            variant="outline-danger"
                                            shadow={false}
                                            className="w-100"
                                            icon="mdi mdi-cancel"
                                            onClick={() => setDialog('cancel')}
                                        >
                                            Cancel entry
                                        </Button>
                                    )}
                                </div>
                                {!entry.canEdit && (
                                    <div className="rs-actions-help">
                                        Answers can no longer be edited once someone has acted on this entry.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <RecordActionModal
                show={dialog === 'approve'}
                onHide={() => setDialog(null)}
                action={route('form.admin.approve', record.id)}
                icon="mdi-check"
                tone="success"
                title="Approve submission?"
                remark={{ label: 'Remark (optional)', placeholder: 'Add a remark...' }}
                confirmLabel="Yes, Approve"
                confirmVariant="success"
            >
                You&apos;re approving <strong>{record.reference}</strong> from <strong>{record.submitted_by}</strong>
                {review.stageName && (
                    <>
                        {' '}
                        for the <strong>{review.stageName}</strong> stage
                    </>
                )}
                .
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'reject'}
                onHide={() => setDialog(null)}
                action={route('form.admin.reject', record.id)}
                icon="mdi-close"
                tone="danger"
                title="Reject submission?"
                remark={{
                    label: 'Reason for rejection *',
                    placeholder: 'State the reason for rejection...',
                    required: 'A rejection remark is required.',
                }}
                confirmLabel="Yes, Reject"
                confirmVariant="danger"
            >
                The submitter will be notified with your reason. This ends the current approval flow for{' '}
                <strong>{record.reference}</strong>.
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'close'}
                onHide={() => setDialog(null)}
                action={route('form.records.close', record.id)}
                icon="mdi-lock-outline"
                tone="danger"
                title="Close this record?"
                remark={{
                    label: 'Reason for closing *',
                    placeholder: 'Why is this record being closed?',
                    required: 'A reason is required to close a record.',
                }}
                confirmLabel="Yes, Close Record"
                confirmVariant="danger"
            >
                <strong>{record.title}</strong> ({record.reference}) will be marked closed.
                {record.status === 'pending' && (
                    <div className="alert alert-warning py-2 px-3 small mt-3 mb-0">
                        This case is <strong>still in progress</strong> and will be <strong>cancelled</strong>. Whoever
                        is holding it will lose the task.
                    </div>
                )}
                <div className="text-muted small mt-3">A closed case can still be followed up on later.</div>
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'cancel'}
                onHide={() => setDialog(null)}
                action={route('form.submission.cancel', record.id)}
                icon="mdi-cancel"
                tone="danger"
                title="Cancel this submission?"
                confirmLabel="Yes, cancel it"
                confirmVariant="danger"
                cancelLabel="Keep it"
            >
                <strong>{record.reference}</strong> will be withdrawn and removed from{' '}
                {review.waitingFor.length > 0 ? 'the queue of whoever is reviewing it' : 'any pending queue'}. This
                cannot be undone — you would have to submit the form again.
            </RecordActionModal>

            <AssigneePicker people={people} />
            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}
