<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
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
            'name'              => 'required|string|max:255',
            'mobile'            => 'required|unique:users,mobile,'.$this->id,
            'email'             => 'required|email',
            'statuss'           => ['required','integer'],
            'type'              => ['required','integer', Rule::in(array_keys(User::getUserTypeListing()))],
            'gender'            => ['required','string'],
            'telegram_chat_id'  => 'nullable|string',
            'team'              => 'required'
        ];

        $this->isMethod('POST') ? $this->store() : $this->update();
    }

    protected function store()
    {
        return [
            'email' => 'required|email|unique:users,email',
        ];
    }

    protected function update()
    {
        return [
            'email' => 'required|email|unique:users,email,'.Auth::guard('web')->user()->id,
        ];
    }

    /**
     * How the fields read in messages, as the form labels them.
     */
    public function attributes()
    {
        return [
            'name'             => 'full name',
            'mobile'           => 'mobile number',
            'statuss'          => 'status',
            'type'             => 'user type',
            'telegram_chat_id' => 'Telegram chat ID',
        ];
    }
}
