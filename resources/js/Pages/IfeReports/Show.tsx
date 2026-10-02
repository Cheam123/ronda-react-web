import { useState, type ReactNode } from 'react';
import PageHeader from '@/Components/surface/PageHeader';
import SurfacePage from '@/Components/surface/SurfacePage';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { formatPhone, phoneHref } from '@/lib/phone';
import type { QueryParams } from '@/types';

interface IfeReport {
    id: number;
    salesperson: string | null;
    created_at: string;
    updated_at: string;
    task_title: string | null;
    company_name: string | null;
    nature_of_business: string | null;
    status: string | null;
    shop_name: string | null;
    ife_area: string | null;
    location: string | null;
    problem_description: string | null;
    support_required: string | null;
    support_description: string | null;
    personal_remarks: string | null;
    pic_name: string | null;
    mobile_number: string | null;
    other_mobile_numbers: string | null;
    email: string | null;
    next_followup_date: string | null;
    next_followup_plan: string | null;
    photos: { id: number; url: string }[];
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rd-panel lead-card">
            <h2 className="rd-panel__title">{title}</h2>
            {children}
        </section>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{children || <span className="rd-muted">—</span>}</dd>
        </>
    );
}

/** A block of report text, or a dash when the rep left it empty. */
function Text({ label, children }: { label: string; children: string | null }) {
    return (
        <div className="ife-text">
            <h3 className="ife-text__label">{label}</h3>
            {children ? <p className="ife-text__body">{children}</p> : <p className="rd-muted mb-0">—</p>}
        </div>
    );
}

function Phone({ value }: { value: string | null }) {
    if (!value) return null;
    const href = phoneHref(value);

    return href ? (
        <a href={href} className="rd-facts__phone">
            <i className="mdi mdi-phone-outline" aria-hidden="true" />
            {formatPhone(value)}
        </a>
    ) : (
        <>{value}</>
    );
}

interface ShowIfeReportProps {
    report: IfeReport;
    filters: QueryParams;
}

/** One visit report: what happened and what's next, the outlet and who to call beside it. */
export default function ShowIfeReport({ report, filters }: ShowIfeReportProps) {
    const [photo, setPhoto] = useState<string | null>(null);
    const title = report.shop_name || report.company_name || 'Visit report';
    const needsSupport = (report.support_required ?? '').toLowerCase() === 'yes';

    return (
        <AppLayout title={`IFE report: ${title}`}>
            <SurfacePage>
                <PageHeader
                    crumbs={[
                        { label: 'Home', href: '/index' },
                        { label: 'IFE Report', href: route('ifereport.index', filters) },
                        { label: title },
                    ]}
                    title={title}
                    meta={
                        <>
                            {report.status && <span className="rd-chip">{report.status}</span>}
                            {report.ife_area && <span className="rd-tag">{report.ife_area}</span>}
                            <span>
                                {report.salesperson ? `By ${report.salesperson}, ` : ''}
                                {report.created_at}
                            </span>
                        </>
                    }
                />

                <div className="lead-page">
                    <div className="lead-page__aside">
                        <Panel title="What happened">
                            <Text label="Problem">{report.problem_description}</Text>
                            <div className="ife-text">
                                <h3 className="ife-text__label">Needs support</h3>
                                {needsSupport ? (
                                    <span className="rd-chip rd-chip--serious align-self-start">
                                        <span className="rd-dot" />
                                        Yes
                                    </span>
                                ) : (
                                    <span className="rd-chip align-self-start">{report.support_required || 'No'}</span>
                                )}
                            </div>
                            {needsSupport && <Text label="Support needed">{report.support_description}</Text>}
                            <Text label="Advice, suggestion or opportunity">{report.personal_remarks}</Text>
                        </Panel>

                        <Panel title="Follow-up">
                            <dl className="rd-facts">
                                <Fact label="Next visit">{report.next_followup_date}</Fact>
                                <Fact label="Plan">{report.next_followup_plan}</Fact>
                            </dl>
                        </Panel>

                        {report.photos.length > 0 && (
                            <Panel title="Photos">
                                <div className="ife-photos">
                                    {report.photos.map((document, index) => (
                                        <button
                                            key={document.id}
                                            type="button"
                                            className="ife-photos__item"
                                            aria-label={`Open photo ${index + 1}`}
                                            onClick={() => setPhoto(document.url)}
                                        >
                                            <img src={document.url} alt="" />
                                        </button>
                                    ))}
                                </div>
                            </Panel>
                        )}
                    </div>

                    <aside className="lead-page__aside">
                        <Panel title="Outlet">
                            <dl className="rd-facts">
                                <Fact label="Company">{report.company_name}</Fact>
                                <Fact label="Shop">{report.shop_name}</Fact>
                                <Fact label="Business">{report.nature_of_business}</Fact>
                                <Fact label="Location">{report.location}</Fact>
                            </dl>
                        </Panel>
                        <Panel title="Contact">
                            <dl className="rd-facts">
                                <Fact label="Person">{report.pic_name}</Fact>
                                <Fact label="Mobile">
                                    <Phone value={report.mobile_number} />
                                </Fact>
                                <Fact label="Other numbers">{report.other_mobile_numbers}</Fact>
                                <Fact label="Email">
                                    {report.email && <a href={`mailto:${report.email}`}>{report.email}</a>}
                                </Fact>
                            </dl>
                        </Panel>
                        <Panel title="Report">
                            <dl className="rd-facts">
                                <Fact label="Task">{report.task_title}</Fact>
                                <Fact label="By">{report.salesperson}</Fact>
                                <Fact label="Filed">{report.created_at}</Fact>
                                <Fact label="Updated">{report.updated_at}</Fact>
                            </dl>
                        </Panel>
                    </aside>
                </div>
            </SurfacePage>

            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}
