import Field from '@/Components/form/Field';
import GpsStampField from '@/Components/form/GpsStampField';
import SearchSelect from '@/Components/form/SearchSelect';
import Select from '@/Components/form/Select';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { digitsOnly } from '@/lib/input';
import type { LeadFormOptions } from '@/types/leads';

/** The lead form's fields, named as LeadRequest expects them. */
export interface LeadFormData {
    name: string;
    receive_date: string;
    business_name: string;
    customer_id: string;
    mobile: string;
    email: string;
    leadsource: string;
    businesscat: string;
    address: string;
    state_id: string;
    city_id: string;
    postcode: string;
    ifearea: string;
    size_band: string;
    seats: string;
    segment: string;
    gps: string;
    remark: string;
}

interface LeadFieldsProps {
    data: LeadFormData;
    setData?: <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => void;
    errors?: Partial<Record<keyof LeadFormData, string>>;
    options: LeadFormOptions;
    readOnly?: boolean;
}

/** Lead/Customer detail and outlet profile, editable or read-only. */
export default function LeadFields({ data, setData, errors = {}, options, readOnly = false }: LeadFieldsProps) {
    const update = <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => setData?.(key, value);
    const cities = options.cities.filter((city) => String(city.state_id) === data.state_id);

    return (
        <>
            <div className="row">
                <Field label="Company Name" htmlFor="name" required error={errors.name} className="col-md-9">
                    <TextInput
                        id="name"
                        maxLength={255}
                        readOnly={readOnly}
                        value={data.name}
                        onChange={(event) => update('name', event.target.value)}
                    />
                </Field>
                <Field
                    label="Receiving Date"
                    htmlFor="receive_date"
                    required
                    error={errors.receive_date}
                    className="col-md-3"
                >
                    <TextInput
                        id="receive_date"
                        type="date"
                        readOnly={readOnly}
                        value={data.receive_date}
                        onChange={(event) => update('receive_date', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Shop Name" htmlFor="business_name" className="col-md-9">
                    <TextInput
                        id="business_name"
                        maxLength={255}
                        readOnly={readOnly}
                        value={data.business_name}
                        onChange={(event) => update('business_name', event.target.value)}
                    />
                </Field>
                <Field label="Customer ID" htmlFor="customer_id" className="col-md-3">
                    <TextInput
                        id="customer_id"
                        maxLength={20}
                        readOnly={readOnly}
                        value={data.customer_id}
                        onChange={(event) => update('customer_id', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Mobile" htmlFor="mobile" required error={errors.mobile} className="col-md-3">
                    <TextInput
                        id="mobile"
                        type="tel"
                        maxLength={12}
                        onKeyDown={digitsOnly}
                        readOnly={readOnly}
                        value={data.mobile}
                        onChange={(event) => update('mobile', event.target.value)}
                    />
                </Field>
                <Field label="Email" htmlFor="email" error={errors.email} className="col-md-3">
                    <TextInput
                        id="email"
                        type="email"
                        maxLength={255}
                        readOnly={readOnly}
                        value={data.email}
                        onChange={(event) => update('email', event.target.value)}
                    />
                </Field>
                <Field label="Source of Lead/Customer" htmlFor="leadsource" className="col-md-3">
                    <Select
                        id="leadsource"
                        placeholder="-- Select Source --"
                        options={options.sources}
                        disabled={readOnly}
                        value={data.leadsource}
                        onChange={(event) => update('leadsource', event.target.value)}
                    />
                </Field>
                <Field label="Business Category" htmlFor="businesscat" className="col-md-3">
                    <Select
                        id="businesscat"
                        placeholder="-- Select Category --"
                        options={options.businessCategories}
                        disabled={readOnly}
                        value={data.businesscat}
                        onChange={(event) => update('businesscat', event.target.value)}
                    />
                </Field>
            </div>

            <div className="row">
                <Field label="Address" htmlFor="address" error={errors.address} className="col-12">
                    <TextArea
                        id="address"
                        maxLength={500}
                        readOnly={readOnly}
                        value={data.address}
                        onChange={(event) => update('address', event.target.value)}
                    />
                </Field>
                <Field label="State" htmlFor="state_id" error={errors.state_id} className="col-md-3">
                    <SearchSelect
                        id="state_id"
                        placeholder="-- Select State --"
                        options={options.states}
                        disabled={readOnly}
                        value={data.state_id}
                        onChange={(value) => {
                            update('state_id', value);
                            update('city_id', '');
                        }}
                    />
                </Field>
                <Field label="City" htmlFor="city_id" error={errors.city_id} className="col-md-3">
                    <SearchSelect
                        id="city_id"
                        placeholder="-- Select City --"
                        options={cities}
                        disabled={readOnly}
                        value={data.city_id}
                        onChange={(value) => update('city_id', value)}
                    />
                </Field>
                <Field label="Postcode" htmlFor="postcode" error={errors.postcode} className="col-md-3">
                    <TextInput
                        id="postcode"
                        type="tel"
                        maxLength={5}
                        onKeyDown={digitsOnly}
                        readOnly={readOnly}
                        value={data.postcode}
                        onChange={(event) => update('postcode', event.target.value)}
                    />
                </Field>
                <Field label="IFE Area" htmlFor="ifearea" error={errors.ifearea} className="col-md-3">
                    <SearchSelect
                        id="ifearea"
                        placeholder="-- Select IFE Area --"
                        options={options.ifeAreas}
                        disabled={readOnly}
                        value={data.ifearea}
                        onChange={(value) => update('ifearea', value)}
                    />
                </Field>
            </div>

            {/* Outlet profile: what the recommendation engine compares outlets on. */}
            <div className="row">
                <Field label="Outlet Size" htmlFor="size_band" error={errors.size_band} className="col-md-3">
                    <Select
                        id="size_band"
                        placeholder="-- Select Size --"
                        options={options.sizeBands}
                        disabled={readOnly}
                        value={data.size_band}
                        onChange={(event) => update('size_band', event.target.value)}
                    />
                </Field>
                <Field label="Seats" htmlFor="seats" error={errors.seats} className="col-md-3">
                    <TextInput
                        id="seats"
                        type="number"
                        min={0}
                        max={5000}
                        readOnly={readOnly}
                        value={data.seats}
                        onChange={(event) => update('seats', event.target.value)}
                    />
                </Field>
                <Field label="Segment" htmlFor="segment" error={errors.segment} className="col-md-3">
                    <Select
                        id="segment"
                        placeholder="-- Select Segment --"
                        options={options.segments}
                        disabled={readOnly}
                        value={data.segment}
                        onChange={(event) => update('segment', event.target.value)}
                    />
                </Field>
                {/* Manual only: editing at the office must not stamp the office. */}
                <Field
                    label="Outlet Location"
                    error={errors.gps}
                    hint={readOnly ? undefined : 'Stamp this while you are at the outlet.'}
                    className="col-12"
                >
                    <GpsStampField value={data.gps} onChange={(value) => update('gps', value)} readOnly={readOnly} />
                </Field>
            </div>

            <Field label="Remark" htmlFor="remark" error={errors.remark}>
                <TextArea
                    id="remark"
                    rows={10}
                    maxLength={255}
                    readOnly={readOnly}
                    value={data.remark}
                    onChange={(event) => update('remark', event.target.value)}
                />
            </Field>
        </>
    );
}
