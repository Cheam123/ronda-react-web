import type { Lead } from '@/types/leads';
import type { LeadFormData } from './LeadFields';

const text = (value: string | number | null | undefined): string =>
    value === null || value === undefined ? '' : String(value);

/** The form's initial values: a lead's current details, or blanks for a new one. */
export function leadFormData(lead: Lead | null, today: string): LeadFormData {
    return {
        name: text(lead?.name),
        receive_date: lead?.receiving_date ?? today,
        business_name: text(lead?.business_name),
        customer_id: text(lead?.customer_id),
        mobile: text(lead?.mobile),
        email: text(lead?.email),
        leadsource: text(lead?.source),
        businesscat: text(lead?.business_category),
        address: text(lead?.address),
        state_id: text(lead?.state_id),
        city_id: text(lead?.city_id),
        postcode: text(lead?.postcode),
        ifearea: text(lead?.ife_area_id),
        size_band: text(lead?.size_band),
        seats: text(lead?.seats),
        segment: text(lead?.segment),
        gps: lead?.gps ?? '',
        remark: text(lead?.remark),
    };
}
