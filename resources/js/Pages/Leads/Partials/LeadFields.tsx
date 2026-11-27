import Field from '@/Components/form/Field';
import MapPickerField, { type MapPlace } from '@/Components/form/MapPickerField';
import SearchSelect, { MultiSearchSelect } from '@/Components/form/SearchSelect';
import TextArea from '@/Components/form/TextArea';
import TextInput from '@/Components/form/TextInput';
import { Choices } from '@/Components/surface/Choices';
import { FormRow, FormSection } from '@/Components/surface/FormSection';
import { MultiChoices } from '@/Components/surface/MultiChoices';
import PhoneInput from '@/Components/surface/PhoneInput';
import { digitsOnly } from '@/lib/input';
import type { LeadFormOptions } from '@/types/leads';

const HALAL_OPTIONS = [
    { value: '1', label: 'Yes' },
    { value: '0', label: 'No' },
];

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
    /** "1", "0", or "" for not stated. */
    is_halal: string;
    /** Customer group keys; empty for not stated. */
    main_customers: string[];
    /** Drink kind keys; empty for not stated. */
    best_selling_kinds: string[];
    /** Goal keys; empty for not stated. */
    improvement_goals: string[];
    /** RM amount as typed; "" for not stated. */
    typical_drink_price: string;
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

/** The lead form's sections: the outlet, its address, its profile, what it needs and a remark. */
export default function LeadFields({ data, setData, errors = {}, options }: LeadFieldsProps) {
    const cities = options.cities.filter((city) => String(city.state_id) === data.state_id);
    const area = options.ifeAreas.find((option) => String(option.value) === data.ifearea);

    /** The address found at the map pin: fills what is empty, or everything when the rep asks. */
    const applyPlace = (place: MapPlace, replace: boolean) => {
        const fills = (current: string) => replace || current.trim() === '';
        if (place.address && fills(data.address)) setData('address', place.address.slice(0, 500));
        const postcode = (place.postcode ?? '').replace(/\D/g, '').slice(0, 5);
        if (postcode && fills(data.postcode)) setData('postcode', postcode);
        if (place.state_id && fills(data.state_id)) {
            setData('state_id', String(place.state_id));
            setData('city_id', place.city_id ? String(place.city_id) : '');
        } else if (place.city_id && data.state_id === String(place.state_id) && fills(data.city_id)) {
            setData('city_id', String(place.city_id));
        }
    };

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
                {/* Never moves by itself: editing at the office keeps the saved pin. */}
                <Field
                    label="On the map"
                    error={errors.gps}
                    hint="Search for the outlet, click the map or drag the pin. Empty address fields below fill in from the pin."
                >
                    <MapPickerField value={data.gps} onChange={(value) => setData('gps', value)} onPlace={applyPlace} />
                </Field>
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

            <FormSection title="Outlet profile" intro="How big the outlet is and who it serves.">
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
                            aria-invalid={errors.seats ? true : undefined}
                            aria-describedby={errors.seats ? 'seats-error' : 'seats-hint'}
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
                <Choices
                    legend="Only stocks halal products?"
                    options={HALAL_OPTIONS}
                    value={data.is_halal}
                    error={errors.is_halal}
                    hint="Leave it empty if you don't know."
                    onChange={(value) => setData('is_halal', value)}
                />
            </FormSection>

            <FormSection
                title="What the outlet needs"
                intro="What the owner tells you. Drink ideas use it. Leave anything you don't know empty."
            >
                <Field
                    label="Main customers"
                    htmlFor="main_customers"
                    error={errors.main_customers}
                    hint="Who mostly buys here. Pick as many as apply."
                >
                    <MultiSearchSelect
                        id="main_customers"
                        options={options.customerGroups}
                        placeholder="Choose who mostly buys here…"
                        searchable={false}
                        value={data.main_customers}
                        onChange={(value) => setData('main_customers', value)}
                    />
                </Field>
                <MultiChoices
                    legend="Their best-selling drinks"
                    options={options.drinkKinds}
                    value={data.best_selling_kinds}
                    error={errors.best_selling_kinds}
                    hint="The kinds of drink that sell most here."
                    onChange={(value) => setData('best_selling_kinds', value)}
                />
                <MultiChoices
                    legend="What they want to improve"
                    options={options.goals}
                    value={data.improvement_goals}
                    error={errors.improvement_goals}
                    hint="Pick everything the owner mentions."
                    onChange={(value) => setData('improvement_goals', value)}
                />
                <Field
                    label="Typical drink price"
                    htmlFor="typical_drink_price"
                    error={errors.typical_drink_price}
                    hint="What a usual drink costs here."
                >
                    <div
                        className={errors.typical_drink_price ? 'rd-affix is-invalid' : 'rd-affix'}
                        style={{ width: 200 }}
                    >
                        <span className="rd-affix__start" aria-hidden="true">
                            RM
                        </span>
                        <input
                            id="typical_drink_price"
                            type="number"
                            inputMode="decimal"
                            min={1}
                            max={100}
                            step={0.1}
                            aria-invalid={errors.typical_drink_price ? true : undefined}
                            aria-describedby={
                                errors.typical_drink_price ? 'typical_drink_price-error' : 'typical_drink_price-hint'
                            }
                            value={data.typical_drink_price}
                            onChange={(event) => setData('typical_drink_price', event.target.value)}
                        />
                    </div>
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
