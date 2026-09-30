import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import InfoList, { type InfoItem } from '@/Components/ui/InfoList';
import Pill from '@/Components/ui/Pill';
import type { Lead, TaskSummary } from '@/types/leads';

interface TaskHistoriesProps {
    lead: Lead;
    tasks: TaskSummary[];
}

/** "Label : name" rows for a list of people; only the first row carries the label. */
function peopleRows(label: string, names: string[]): InfoItem[] {
    return names.map((name, index) => [index === 0 ? label : '', name]);
}

/** Every task raised on the lead, with who handles it and where it stands. */
export default function TaskHistories({ lead, tasks }: TaskHistoriesProps) {
    return (
        <DataTable>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Lead/Customer Information</th>
                    <th>Task Information</th>
                    <th>Manage By</th>
                    <th>Status</th>
                    <th style={{ width: 30 }} />
                </tr>
            </thead>
            <tbody>
                {tasks.map((task, index) => (
                    <tr key={task.id} className="custom-font-xsmall">
                        <td>{index + 1}</td>
                        <td>
                            <span className="text-uppercase">{lead.name}</span>
                            <InfoList
                                items={[
                                    ['Shop Name', lead.business_name],
                                    ['Customer ID', lead.customer_id],
                                    ['Mobile', lead.mobile],
                                    ['Email', lead.email],
                                ]}
                            />
                        </td>
                        <td>
                            <InfoList
                                items={[
                                    ['Reference No', task.reference],
                                    ['Lead/Customer Source', task.lead_source],
                                    ['Business Category', task.business_category],
                                    ['Appointment Date', task.appointment && <Pill tone="blue">{task.appointment}</Pill>],
                                ]}
                            />
                        </td>
                        <td>
                            <InfoList
                                items={[
                                    ['Subscriber', task.subscriber && <Pill tone="green">{task.subscriber}</Pill>],
                                    ...peopleRows('Sub-Subscriber(s)', task.sub_subscribers),
                                    ['Checked By', task.checker],
                                    ['Created By', task.creator],
                                    ...peopleRows('Owner(s)', task.owners),
                                ]}
                            />
                        </td>
                        <td>
                            <Pill tone="navy">{task.status_label}</Pill>
                            {task.status_date && (
                                <div>
                                    <span className="text-primary">{task.status === 1 ? 'Created' : task.status_label}</span>{' '}
                                    on
                                    <br />
                                    {task.status_date}
                                </div>
                            )}
                            {task.last_updated && (
                                <>
                                    <div className="mt-2 text-danger">Last Updated on</div>
                                    <Pill tone="blue">{task.last_updated}</Pill>
                                </>
                            )}
                        </td>
                        <td>
                            <div className="d-flex gap-1 pe-2">
                                <a href={route('tasks.view', { id: task.id, mode: 'comment' })} target="_blank" rel="noopener noreferrer" title="Open chat">
                                    <i className="mdi mdi-forum-outline font-size-22" />
                                </a>
                                <a href={route('tasks.view', task.id)} target="_blank" rel="noopener noreferrer" title="Open task">
                                    <i className="mdi mdi-clipboard-outline font-size-22" />
                                </a>
                            </div>
                        </td>
                    </tr>
                ))}
                {tasks.length === 0 && <EmptyRow colSpan={6}>No tasks yet.</EmptyRow>}
            </tbody>
        </DataTable>
    );
}
