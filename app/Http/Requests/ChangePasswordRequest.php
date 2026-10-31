<?php

namespace App\Http\Requests;

use App\Support\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class ChangePasswordRequest extends FormRequest
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
            'pass1'     => PasswordPolicy::rules(),
            'pass2'     => 'required|same:pass1',
            'oldpass'   => 'required',
        ];
    }

    public function messages()
    {
        return PasswordPolicy::messages('pass1') + [
            'pass2.required'   => 'Type the new password again.',
            'pass2.same'       => 'The two new passwords don’t match.',
            'oldpass.required' => 'Enter your current password.',
        ];
    }
}
