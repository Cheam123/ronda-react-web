import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import AssigneePicker from '@/Components/forms/AssigneePicker';
import { ResponseSections, type ResponseSectionData } from '@/Components/forms/ResponseField';
import StatusBadge from '@/Components/forms/StatusBadge';
import Initials from '@/Components/surface/Initials';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
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

type Dialog = 'approve' | 'reject' | 'close' | 'cancel' | null;

/** "Ana and Ben", "Ana, Ben and Cy". */
const listNames = (names: string[]) =>
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');

/** One record: its answers, its progress, the viewer's part in it, and related records. */
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
    const hasEntryActions = entry.canEdit || entry.canCancel || entry.canClone;
    // A branch or loop may still add steps the record does not have yet.
    const afterApproving = review.nextStage
        ? `Approving moves it on to ${review.nextStage}.`
        : timeline.process_open
          ? 'Approving moves it on; the next steps depend on the answers.'
          : 'Approving completes it.';

    return (
        <AppLayout title={`${record.reference} ${record.title}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'My records', href: route('form.records.index') },
                        { label: record.reference },
                    ]}
                    title={record.title}
                    meta={
                        <>
                            <StatusBadge status={record.open ? record.status : 'closed'} />
                            <span className="rd-mono">{record.reference}</span>
                            <span className="rd-chip">{record.form.name}</span>
                            <span className="form-record__by">
                                <Initials name={record.submitted_by} size="sm" />
                                <span>
                                    Submitted by <strong>{record.submitted_by}</strong>, {record.submitted_at}
                                </span>
                            </span>
                        </>
                    }
                    actions={
                        <>
                            {canFollowUp && (
                                <Link
                                    href={route('form.fill', { id: record.form.id, parent: record.id })}
                                    className="rd-btn rd-btn--lg"
                                >
                                    <i className="mdi mdi-subdirectory-arrow-right" aria-hidden="true" />
                                    Start a follow-up
                                </Link>
                            )}
                            {canClose &&
                                (record.open ? (
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--danger-soft rd-btn--lg"
                                        onClick={() => setDialog('close')}
                                    >
                                        <i className="mdi mdi-lock-outline" aria-hidden="true" />
                                        Close record
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--lg"
                                        onClick={() => router.post(route('form.records.reopen', record.id))}
                                    >
                                        <i className="mdi mdi-lock-open-variant-outline" aria-hidden="true" />
                                        Reopen
                                    </button>
                                ))}
                        </>
                    }
                />

                {record.closed && (
                    <div className="form-record__closed">
                        <i className="mdi mdi-lock-outline" aria-hidden="true" />
                        <div>
                            <strong>This record is closed.</strong>
                            {record.closed.at && (
                                <span>
                                    {' '}
                                    Closed by {record.closed.by}, {record.closed.at}.
                                </span>
                            )}
                            {record.closed.remark && <p>{record.closed.remark}</p>}
                        </div>
                    </div>
                )}

                <div className="form-record">
                    <div className="form-record__main">
                        <section className="rd-panel rd-panel--flush form-record__card" aria-labelledby="answers">
                            <div className="form-record__card-head">
                                <h2 id="answers" className="rd-panel__title">
                                    Answers
                                </h2>
                                <span className="rd-muted">
                                    {pluralize(responses.fieldCount, 'field')}
                                    {responses.sectionCount > 0 && ` in ${pluralize(responses.sectionCount, 'group')}`}
                                </span>
                            </div>
                            {responses.sections.length > 0 ? (
                                <div className="form-record__answers">
                                    <ResponseSections sections={responses.sections} onImageClick={setPhoto} />
                                </div>
                            ) : (
                                <p className="rd-list__empty">No answers you can see on this record.</p>
                            )}
                        </section>

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

                        {childCases.length > 0 && (
                            <section className="rd-panel" aria-labelledby="follow-ups">
                                <div className="rd-panel__head">
                                    <h2 id="follow-ups" className="rd-panel__title">
                                        Follow-ups
                                    </h2>
                                    <span className="rd-muted">
                                        {pluralize(childCases.length, 'record')} opened from this one
                                    </span>
                                </div>
                                <ul className="form-record__links">
                                    {childCases.map((child) => (
                                        <li key={child.id}>
                                            <CaseLinkRow link={child} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>

                    <aside className="form-record__aside">
                        {review.canApprove && (
                            <section className="rd-panel form-record__turn" aria-labelledby="your-turn">
                                <div>
                                    <span className="form-record__eyebrow">Your turn</span>
                                    <h2 id="your-turn" className="rd-panel__title">
                                        {review.stageName ?? 'Approval'}
                                    </h2>
                                    <p className="rd-panel__sub">{afterApproving} Rejecting ends it.</p>
                                </div>
                                <div className="form-record__decide">
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--danger-soft rd-btn--lg"
                                        onClick={() => setDialog('reject')}
                                    >
                                        <i className="mdi mdi-close" aria-hidden="true" />
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        className="rd-btn rd-btn--primary rd-btn--lg"
                                        onClick={() => setDialog('approve')}
                                    >
                                        <i className="mdi mdi-check" aria-hidden="true" />
                                        Approve
                                    </button>
                                </div>
                            </section>
                        )}

                        {fillStage && !review.canApprove && (
                            <section className="rd-panel form-record__turn" aria-labelledby="your-fill-turn">
                                <span className="form-record__eyebrow">Your turn</span>
                                <h2 id="your-fill-turn" className="rd-panel__title">
                                    {fillStage.name}
                                </h2>
                                <p className="rd-panel__sub">Fill in your part under the answers, then send it.</p>
                                <a href="#your-part" className="rd-btn rd-btn--primary rd-btn--lg">
                                    Go to my part
                                </a>
                            </section>
                        )}

                        {!review.canApprove && !fillStage && review.waitingFor.length > 0 && (
                            <p className="form-record__waiting">
                                <i className="mdi mdi-timer-sand" aria-hidden="true" />
                                <span>
                                    Waiting on <strong>{listNames(review.waitingFor)}</strong>
                                    {review.stageName && <> for {review.stageName}</>}.
                                </span>
                            </p>
                        )}

                        <section className="rd-panel" aria-labelledby="progress">
                            <h2 id="progress" className="rd-panel__title">
                                Progress
                            </h2>
                            <ReviewTimeline
                                timeline={timeline}
                                submittedBy={record.submitted_by}
                                canAct={review.canApprove || fillStage !== null}
                                waitingFor={review.waitingFor}
                            />
                        </section>

                        {parentCase && (
                            <section className="rd-panel" aria-labelledby="follows-up-on">
                                <h2 id="follows-up-on" className="rd-panel__title">
                                    Follows up on
                                </h2>
                                <CaseLinkRow link={parentCase} />
                            </section>
                        )}

                        {hasEntryActions && (
                            <section className="rd-panel" aria-labelledby="this-entry">
                                <h2 id="this-entry" className="rd-panel__title">
                                    Your entry
                                </h2>
                                <div className="form-record__entry">
                                    {entry.canEdit && (
                                        <Link
                                            href={route('form.submission.edit', record.id)}
                                            className="rd-btn rd-btn--lg"
                                        >
                                            <i className="mdi mdi-pencil-outline" aria-hidden="true" />
                                            Edit answers
                                        </Link>
                                    )}
                                    {entry.canClone && (
                                        <Link
                                            href={route('form.submission.clone', record.id)}
                                            className="rd-btn rd-btn--lg"
                                        >
                                            <i className="mdi mdi-content-copy" aria-hidden="true" />
                                            Start a new record from this
                                        </Link>
                                    )}
                                    {entry.canCancel && (
                                        <button
                                            type="button"
                                            className="rd-btn rd-btn--danger-soft rd-btn--lg"
                                            onClick={() => setDialog('cancel')}
                                        >
                                            <i className="mdi mdi-cancel" aria-hidden="true" />
                                            Cancel it
                                        </button>
                                    )}
                                </div>
                                {!entry.canEdit && (
                                    <p className="rd-panel__sub">
                                        Answers can&rsquo;t be changed once someone has acted on the record.
                                    </p>
                                )}
                            </section>
                        )}
                    </aside>
                </div>
            </SurfacePage>

            <RecordActionModal
                show={dialog === 'approve'}
                onHide={() => setDialog(null)}
                action={route('form.admin.approve', record.id)}
                icon="mdi-check"
                tone="good"
                title="Approve this record?"
                remark={{ label: 'Remark', placeholder: 'Anything the next person should know (optional)' }}
                confirmLabel="Approve"
            >
                {record.reference} from {record.submitted_by}
                {review.stageName && <>, at {review.stageName}</>}. {afterApproving}
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'reject'}
                onHide={() => setDialog(null)}
                action={route('form.admin.reject', record.id)}
                icon="mdi-close"
                tone="critical"
                title="Reject this record?"
                remark={{
                    label: 'Reason',
                    placeholder: 'Why it is rejected',
                    required: 'Give a reason for rejecting it.',
                }}
                confirmLabel="Reject"
                danger
            >
                It ends here, and {record.submitted_by} is told your reason.
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'close'}
                onHide={() => setDialog(null)}
                action={route('form.records.close', record.id)}
                icon="mdi-lock-outline"
                tone="neutral"
                title="Close this record?"
                remark={{
                    label: 'Reason',
                    placeholder: 'Why it is being closed',
                    required: 'Give a reason for closing it.',
                }}
                confirmLabel="Close record"
                danger
            >
                {record.title} ({record.reference}) is marked closed. It can still be followed up on later.
                {record.status === 'pending' && (
                    <p className="rd-notice form-record__warn">
                        <i className="mdi mdi-alert-outline" aria-hidden="true" />
                        It is still in review, so it is cancelled too. Whoever has it loses the task.
                    </p>
                )}
            </RecordActionModal>

            <RecordActionModal
                show={dialog === 'cancel'}
                onHide={() => setDialog(null)}
                action={route('form.submission.cancel', record.id)}
                icon="mdi-cancel"
                tone="critical"
                title="Cancel your entry?"
                confirmLabel="Cancel it"
                cancelLabel="Keep it"
                danger
            >
                {record.reference} is withdrawn
                {review.waitingFor.length > 0 ? ' and leaves the task list of whoever has it' : ''}. This can&rsquo;t be
                undone: you would have to submit the form again.
            </RecordActionModal>

            <AssigneePicker people={people} />
            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}

/** A linked record: reference, title, status. */
function CaseLinkRow({ link }: { link: CaseLink }) {
    return (
        <Link href={route('form.records.show', link.id)} className="form-record__link">
            <span className="rd-mono">{link.reference}</span>
            <span className="form-record__link-text">
                <span className="form-record__link-title">{link.title}</span>
                {(link.created_at || link.submitted_by) && (
                    <span className="rd-muted">{[link.submitted_by, link.created_at].filter(Boolean).join(', ')}</span>
                )}
            </span>
            <StatusBadge status={link.open ? link.status : 'closed'} />
            <i className="mdi mdi-chevron-right" aria-hidden="true" />
        </Link>
    );
}
