<?php

namespace App\Http\Requests;

use App\Models\Leads;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class LeadRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'id'            => 'nullable',
            'receive_date'  => 'required',
            'customer_id'   => 'nullable',
            'business_name' => 'nullable',
            'name'          => 'required|string|max:255',
            'email'         => 'nullable|string|max:255',
            'mobile'        => 'required|string|max:15',
            'address'       => 'nullable|string|max:500',
            'ifearea'       => 'nullable',
            'businesscat'   => 'nullable',
            'leadsource'    => 'nullable',
            'state_id'      => 'nullable',
            'city_id'       => 'nullable',
            'postcode'      => 'nullable',
            'remark'        => 'nullable|string',
            'file'          => 'nullable',
            // Outlet profile. The location ("gps") is checked by
            // Leads::applyLocationStamp(), the same rules as a GPS Stamp field.
            'size_band'     => 'nullable|in:' . implode(',', array_keys(Leads::SIZE_BANDS)),
            'seats'         => 'nullable|integer|min:0|max:5000',
            'segment'       => 'nullable|in:' . implode(',', array_keys(Leads::SEGMENTS)),
            'gps'           => 'nullable',
        ];
    }

    /**
     * How the fields read in messages, as the form labels them
     * ("The company name field is required.").
     */
    public function attributes()
    {
        return [
            'name'          => 'company name',
            'receive_date'  => 'received on date',
            'business_name' => 'shop name',
            'customer_id'   => 'customer ID',
            'leadsource'    => 'source',
            'businesscat'   => 'business category',
            'state_id'      => 'state',
            'city_id'       => 'city',
            'ifearea'       => 'IFE area',
            'size_band'     => 'size',
            'gps'           => 'location',
        ];
    }
}
