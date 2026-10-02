import Field from '@/Components/form/Field';
import GpsStampField from '@/Components/form/GpsStampField';
import SearchSelect from '@/Components/form/SearchSelect';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { Choices } from '@/Components/surface/Choices';
import { FormRow, FormSection } from '@/Components/surface/FormSection';
import PhoneInput from '@/Components/surface/PhoneInput';
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

const REMARK_MAX = 255;

interface LeadFieldsProps {
    data: LeadFormData;
    setData: <K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) => void;
    errors?: Partial<Record<keyof LeadFormData, string>>;
    options: LeadFormOptions;
}

/** The lead form's sections: the outlet, its address, its profile and a remark. */
export default function LeadFields({ data, setData, errors = {}, options }: LeadFieldsProps) {
    const cities = options.cities.filter((city) => String(city.state_id) === data.state_id);
    const area = options.ifeAreas.find((option) => String(option.value) === data.ifearea);

    return (
        <>
            <FormSection title="Outlet" intro="Who they are and how the team reaches them.">
                <FormRow columns="minmax(0, 1fr) 190px">
                    <Field label="Company name" htmlFor="name" required error={errors.name}>
                        <TextInput
                            id="name"
                            large
                            maxLength={255}
                            invalid={Boolean(errors.name)}
                            value={data.name}
                            onChange={(event) => setData('name', event.target.value)}
                        />
                    </Field>
                    <Field label="Received on" htmlFor="receive_date" required error={errors.receive_date}>
                        <TextInput
                            id="receive_date"
                            type="date"
                            large
                            invalid={Boolean(errors.receive_date)}
                            value={data.receive_date}
                            onChange={(event) => setData('receive_date', event.target.value)}
                        />
                    </Field>
                </FormRow>
                <FormRow>
                    <Field
                        label="Shop name"
                        htmlFor="business_name"
                        error={errors.business_name}
                        hint="What the outlet is called on the street. The list shows this first."
                    >
                        <TextInput
                            id="business_name"
                            large
                            maxLength={255}
                            value={data.business_name}
                            onChange={(event) => setData('business_name', event.target.value)}
                        />
                    </Field>
                    <Field
                        label="Customer ID"
                        htmlFor="customer_id"
                        error={errors.customer_id}
                        hint="Leave it empty while they are a prospect."
                    >
                        <TextInput
                            id="customer_id"
                            large
                            className="rd-input--mono"
                            maxLength={20}
                            value={data.customer_id}
                            onChange={(event) => setData('customer_id', event.target.value)}
                        />
                    </Field>
                </FormRow>
                <FormRow>
                    <Field
                        label="Mobile"
                        htmlFor="mobile"
                        required
                        error={errors.mobile}
                        hint="Type it any way; the spacing is added for you."
                    >
                        <PhoneInput
                            id="mobile"
                            required
                            invalid={Boolean(errors.mobile)}
                            value={data.mobile}
                            onChange={(value) => setData('mobile', value)}
                        />
                    </Field>
                    <Field label="Email" htmlFor="email" error={errors.email}>
                        <TextInput
                            id="email"
                            type="email"
                            large
                            maxLength={255}
                            placeholder="name@company.com"
                            invalid={Boolean(errors.email)}
                            value={data.email}
                            onChange={(event) => setData('email', event.target.value)}
                        />
                    </Field>
                </FormRow>
                <FormRow>
                    <Field label="How they found us" htmlFor="leadsource" error={errors.leadsource}>
                        <SearchSelect
                            id="leadsource"
                            placeholder="Choose a source"
                            options={options.sources}
                            invalid={Boolean(errors.leadsource)}
                            value={data.leadsource}
                            onChange={(value) => setData('leadsource', value)}
                        />
                    </Field>
                    <Field label="Business category" htmlFor="businesscat" error={errors.businesscat}>
                        <SearchSelect
                            id="businesscat"
                            placeholder="Choose a category"
                            options={options.businessCategories}
                            searchable={false}
                            invalid={Boolean(errors.businesscat)}
                            value={data.businesscat}
                            onChange={(value) => setData('businesscat', value)}
                        />
                    </Field>
                </FormRow>
            </FormSection>

            <FormSection title="Address" intro="Where the outlet is. The IFE area decides who covers it.">
                <Field label="Street address" htmlFor="address" error={errors.address}>
                    <TextArea
                        id="address"
                        maxLength={500}
                        invalid={Boolean(errors.address)}
                        value={data.address}
                        onChange={(event) => setData('address', event.target.value)}
                    />
                </Field>
                <FormRow columns="minmax(0, 1fr) minmax(0, 1fr) 160px">
                    <Field label="State" htmlFor="state_id" error={errors.state_id}>
                        <SearchSelect
                            id="state_id"
                            placeholder="Choose a state"
                            options={options.states}
                            invalid={Boolean(errors.state_id)}
                            value={data.state_id}
                            onChange={(value) => {
                                setData('state_id', value);
                                setData('city_id', '');
                            }}
                        />
                    </Field>
                    <Field label="City" htmlFor="city_id" error={errors.city_id}>
                        <SearchSelect
                            id="city_id"
                            placeholder={data.state_id ? 'Choose a city' : 'Choose the state first'}
                            options={cities}
                            disabled={!data.state_id}
                            invalid={Boolean(errors.city_id)}
                            value={data.city_id}
                            onChange={(value) => setData('city_id', value)}
                        />
                    </Field>
                    <Field label="Postcode" htmlFor="postcode" error={errors.postcode}>
                        <TextInput
                            id="postcode"
                            large
                            inputMode="numeric"
                            maxLength={5}
                            onKeyDown={digitsOnly}
                            invalid={Boolean(errors.postcode)}
                            value={data.postcode}
                            onChange={(event) => setData('postcode', event.target.value)}
                        />
                    </Field>
                </FormRow>
                <FormRow columns="minmax(0, 420px)">
                    <Field label="IFE area" htmlFor="ifearea" error={errors.ifearea} hint={area?.description}>
                        <SearchSelect
                            id="ifearea"
                            placeholder="Choose an area"
                            options={options.ifeAreas}
                            invalid={Boolean(errors.ifearea)}
                            value={data.ifearea}
                            onChange={(value) => setData('ifearea', value)}
                        />
                    </Field>
                </FormRow>
            </FormSection>

            <FormSection title="Outlet profile" intro="What suggested orders compare outlets on.">
                <Choices
                    legend="Size"
                    options={options.sizeBands}
                    value={data.size_band}
                    error={errors.size_band}
                    onChange={(value) => setData('size_band', value)}
                />
                <Field label="Seats" htmlFor="seats" error={errors.seats} hint="0 for a kiosk with no seating.">
                    <div className={errors.seats ? 'rd-affix is-invalid' : 'rd-affix'} style={{ width: 200 }}>
                        <input
                            id="seats"
                            type="number"
                            min={0}
                            max={5000}
                            value={data.seats}
                            onChange={(event) => setData('seats', event.target.value)}
                        />
                        <span className="rd-affix__end">seats</span>
                    </div>
                </Field>
                <Choices
                    legend="Segment"
                    options={options.segments}
                    value={data.segment}
                    error={errors.segment}
                    onChange={(value) => setData('segment', value)}
                />
                {/* Manual only: editing at the office must not stamp the office. */}
                <Field
                    label="Location"
                    error={errors.gps}
                    hint="Stamp it while you are at the outlet. It never stamps by itself, so editing at the office is safe."
                >
                    <GpsStampField value={data.gps} onChange={(value) => setData('gps', value)} />
                </Field>
            </FormSection>

            <FormSection title="Remark" intro="Anything the next visitor should know.">
                <Field label="Remark" htmlFor="remark" error={errors.remark}>
                    <TextArea
                        id="remark"
                        rows={4}
                        maxLength={REMARK_MAX}
                        invalid={Boolean(errors.remark)}
                        value={data.remark}
                        onChange={(event) => setData('remark', event.target.value)}
                    />
                    <span className="rd-form__counter">
                        {data.remark.length} / {REMARK_MAX}
                    </span>
                </Field>
            </FormSection>
        </>
    );
}
