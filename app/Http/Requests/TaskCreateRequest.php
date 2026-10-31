<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class TaskCreateRequest extends FormRequest
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

        $user    = $this->user();
        // Only users who assign tasks to others pick a subscriber and owner;
        // anyone else's task is their own (see TaskController::addTask/store).
        $assigns = $user && $user->can('create_task');

        return [
            'title'                 => 'required',
            'subscriber'            => $assigns ? 'required' : 'nullable',
            'sub_subscriber'        => 'nullable',
            'task_start_date'       => 'required',
            'task_start_time'       => 'required',
            'task_due_date'         => 'required',
            'task_due_time'         => 'required',
            'task_appointment_date' => 'nullable',
            'task_appointment_time' => 'nullable',
            'owner'                 => $assigns ? 'required' : 'nullable',
            'viewer'                => 'nullable',
            'remark'                => 'nullable',
            'lead_id'               => 'required',
            'ife_report_id'         => 'nullable|integer',
        ];
    }
}
