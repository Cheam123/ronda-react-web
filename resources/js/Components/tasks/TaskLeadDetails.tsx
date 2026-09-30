import clsx from 'clsx';
import Field from '@/Components/form/Field';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import SectionHeader from '@/Components/ui/SectionHeader';
import type { TaskLead } from '@/types/tasks';

function ReadOnly({ label, value, className }: { label: string; value: string | null; className?: string }) {
    return (
        <Field label={label} className={clsx('col-md-3', className)}>
            <TextInput value={value ?? ''} readOnly />
        </Field>
    );
}

/** The task's lead, read-only ("Lead/Customer Detail (view only)"). */
export default function TaskLeadDetails({ lead }: { lead: TaskLead }) {
    return (
        <>
            <SectionHeader title="Lead/Customer Detail" note={<span className="text-warning-soft">(view only)</span>} />
            <div className="m-2">
                <div className="row">
                    <ReadOnly label="Company Name" value={lead.name} />
                    <ReadOnly label="Shop Name" value={lead.business_name} />
                    <ReadOnly label="Customer ID" value={lead.customer_id} />
                    <ReadOnly label="Lead/Customer Created By" value={lead.created_by} />
                </div>
                <div className="row">
                    <ReadOnly label="Mobile" value={lead.mobile} />
                    <ReadOnly label="Email" value={lead.email} />
                    <ReadOnly label="Source of Lead/Customer" value={lead.source} />
                    <ReadOnly label="Business Category" value={lead.business_category} />
                </div>
                <div className="row">
                    <Field label="Address" className="col-12">
                        <TextArea rows={3} value={lead.address ?? ''} readOnly />
                    </Field>
                </div>
                <div className="row">
                    <ReadOnly label="State" value={lead.state} />
                    <ReadOnly label="City" value={lead.city} />
                    <ReadOnly label="Postcode" value={lead.postcode} />
                    <ReadOnly label="IFE Area" value={lead.ife_area} />
                </div>
                {lead.remark && (
                    <div className="row">
                        <Field label="Note on Lead/Customer" className="col-12">
                            <TextArea rows={6} value={lead.remark} readOnly />
                        </Field>
                    </div>
                )}
            </div>
        </>
    );
}
