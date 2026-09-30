import FormActions from '@/Components/form/FormActions';
import Card from '@/Components/ui/Card';
import SectionHeader from '@/Components/ui/SectionHeader';
import AppLayout from '@/Layouts/AppLayout';
import { breadcrumbFrom } from '@/lib/breadcrumbs';
import type { BreadcrumbProps } from '@/types';
import type { DocumentFile } from '@/types/documents';
import type { Lead, LeadFormOptions, Order, Recommendation, TaskSummary, Visit } from '@/types/leads';
import DocumentTable from '@/Components/documents/DocumentTable';
import LeadFields from './Partials/LeadFields';
import { leadFormData } from './Partials/leadFormData';
import OutletActivity from './Partials/OutletActivity';
import TaskHistories from './Partials/TaskHistories';

interface ShowLeadProps extends BreadcrumbProps, LeadFormOptions {
    lead: Lead;
    documents: DocumentFile[];
    tasks: TaskSummary[];
    visits: Visit[];
    orders: Order[];
    recommendation: Recommendation | null;
}

/** A lead's details, files, tasks and outlet activity, read-only. */
export default function ShowLead({
    lead,
    documents,
    tasks,
    visits,
    orders,
    recommendation,
    tmenu_part1,
    tmenu_part2,
    tmenu_part3,
    ...options
}: ShowLeadProps) {
    return (
        <AppLayout title="Customer" breadcrumb={breadcrumbFrom({ tmenu_part1, tmenu_part2, tmenu_part3 })}>
            <Card variant="plain">
                <SectionHeader title="Lead/Customer Detail" />
                <div className="m-2">
                    <LeadFields data={leadFormData(lead, '')} options={options} readOnly />
                    <div className="custom-font-xsmall mb-2">
                        <b>Document(s)</b>
                    </div>
                    <DocumentTable documents={documents} previews />
                </div>

                <SectionHeader title="Task Histories" className="mt-3" />
                <div className="m-2">
                    <TaskHistories lead={lead} tasks={tasks} />
                </div>

                <OutletActivity leadId={lead.id} visits={visits} orders={orders} recommendation={recommendation} />

                <FormActions backHref={route('lead.index')} />
            </Card>
        </AppLayout>
    );
}
