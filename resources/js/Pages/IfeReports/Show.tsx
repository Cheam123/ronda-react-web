import { useState, type ReactNode } from 'react';
import FormActions from '@/Components/form/FormActions';
import Card from '@/Components/ui/Card';
import ImageLightbox from '@/Components/ui/ImageLightbox';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps, QueryParams } from '@/types';

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

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="report-section">
            <div className="report-section__title">{title}</div>
            <div className="report-section__body">{children}</div>
        </section>
    );
}

function ReportItem({ label, value }: { label?: string; value: ReactNode }) {
    return (
        <div className="report-item">
            {label && <div className="report-item__label">{label}:</div>}
            <div className="report-item__value">{value || 'N/A'}</div>
        </div>
    );
}

interface ShowIfeReportProps extends BreadcrumbProps {
    report: IfeReport;
    filters: QueryParams;
}

/** One visit report, laid out like the app's report screen. */
export default function ShowIfeReport({ report, filters, ...breadcrumb }: ShowIfeReportProps) {
    const [photo, setPhoto] = useState<string | null>(null);

    return (
        <AppLayout title="IFE Report" breadcrumb={breadcrumbFrom(breadcrumb)}>
            <Card variant="plain">
                <div className="ife-report">
                    <div className="py-2 small">Salesperson : {report.salesperson}</div>

                    <ReportSection title="📊 Report Summary">
                        <ReportItem label="Created On" value={report.created_at} />
                        <ReportItem label="Last Updated" value={report.updated_at} />
                    </ReportSection>

                    <ReportSection title="📋 Task Information">
                        <ReportItem label="Task Title" value={report.task_title} />
                    </ReportSection>

                    <ReportSection title="🏢 Company Information">
                        <ReportItem label="Company Name" value={report.company_name || <em className="text-muted">Not specified</em>} />
                        <ReportItem label="Nature of Business" value={report.nature_of_business} />
                        <ReportItem label="Status" value={report.status} />
                        <ReportItem label="Cafe/Outlet/Shop Name" value={report.shop_name} />
                    </ReportSection>

                    <ReportSection title="📍 Location & Area">
                        <ReportItem label="IFE Area" value={report.ife_area} />
                        <ReportItem label="Location" value={report.location} />
                    </ReportSection>

                    <ReportSection title="🔧 Technical Details">
                        <ReportItem label="Problem" value={report.problem_description} />
                        <ReportItem label="Require Support" value={report.support_required} />
                        <ReportItem label="Support Detail" value={report.support_description} />
                        <ReportItem label="Advise/Suggestion/Opportunity" value={report.personal_remarks} />
                    </ReportSection>

                    <ReportSection title="👤 Contact Information">
                        <ReportItem label="PIC Name" value={report.pic_name} />
                        <ReportItem label="Mobile No" value={report.mobile_number} />
                        <ReportItem label="Other Contact No" value={report.other_mobile_numbers} />
                        <ReportItem label="Email" value={report.email} />
                    </ReportSection>

                    <ReportSection title="📅 Follow-up Schedule">
                        <ReportItem value={report.next_followup_date} />
                        <ReportItem label="Planning" value={report.next_followup_plan} />
                    </ReportSection>

                    <div className="d-flex flex-wrap gap-2 mb-5">
                        {report.photos.map((document) => (
                            <img
                                key={document.id}
                                src={document.url}
                                alt="Visit photo"
                                className="thumb"
                                onClick={() => setPhoto(document.url)}
                            />
                        ))}
                    </div>
                </div>

                <FormActions backHref={route('ifereport.index', filters)} />
            </Card>

            <ImageLightbox src={photo} onClose={() => setPhoto(null)} />
        </AppLayout>
    );
}
