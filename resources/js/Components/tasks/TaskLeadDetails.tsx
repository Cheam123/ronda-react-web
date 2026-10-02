import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import Initials from '@/Components/surface/Initials';
import { useAuth } from '@/hooks/useAuth';
import { formatPhone, phoneHref } from '@/lib/phone';
import type { TaskLead } from '@/types/tasks';

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <>
            <dt>{label}</dt>
            <dd>{children || <span className="rd-muted">—</span>}</dd>
        </>
    );
}

/** The outlet a task is on, beside the task (read-only; its own page edits it). */
export default function TaskLeadDetails({ lead }: { lead: TaskLead }) {
    const { can } = useAuth();
    const title = lead.business_name || lead.name || 'Unnamed outlet';
    const phone = phoneHref(lead.mobile);
    const place = [lead.postcode, lead.city].filter(Boolean).join(' ');

    return (
        <section className="rd-panel lead-card" aria-labelledby="task-outlet-title">
            <div className="lead-card__head">
                <h2 id="task-outlet-title" className="rd-panel__title">
                    Outlet
                </h2>
                {lead.customer_id ? (
                    <span className="rd-chip rd-chip--good">
                        <span className="rd-dot" />
                        Customer
                    </span>
                ) : (
                    <span className="rd-chip rd-chip--serious">
                        <span className="rd-dot" />
                        Prospect
                    </span>
                )}
            </div>
            <div className="rd-person">
                <Initials name={title} colorKey={lead.id} size="lg" />
                <span className="rd-person__text">
                    {can('view_lead') ? (
                        <Link href={route('lead.view', lead.id)} className="rd-person__name">
                            {title}
                        </Link>
                    ) : (
                        <span className="rd-person__name">{title}</span>
                    )}
                    {lead.business_name && lead.name && <span className="rd-person__sub">{lead.name}</span>}
                </span>
            </div>
            <dl className="rd-facts">
                <Fact label="Customer ID">
                    {lead.customer_id && <span className="rd-mono">{lead.customer_id}</span>}
                </Fact>
                <Fact label="Mobile">
                    {lead.mobile &&
                        (phone ? (
                            <a href={phone} className="rd-facts__phone">
                                <i className="mdi mdi-phone-outline" aria-hidden="true" />
                                {formatPhone(lead.mobile)}
                            </a>
                        ) : (
                            formatPhone(lead.mobile)
                        ))}
                </Fact>
                <Fact label="Email">{lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}</Fact>
                <Fact label="Category">{lead.business_category}</Fact>
                <Fact label="Source">{lead.source}</Fact>
                <Fact label="IFE area">{lead.ife_area}</Fact>
                <Fact label="Address">
                    {(lead.address || place || lead.state) && (
                        <span className="lead-where">
                            {[lead.address, [place, lead.state].filter(Boolean).join(', ')].filter(Boolean).join(', ')}
                        </span>
                    )}
                </Fact>
                <Fact label="Created by">{lead.created_by}</Fact>
            </dl>
            {lead.remark && <p className="lead-remark">{lead.remark}</p>}
        </section>
    );
}
