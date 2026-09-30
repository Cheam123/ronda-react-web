<?php

namespace App\Http\Resources\Users;

use App\Helpers\Helper;
use App\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A user for the Users pages. Built field by field: serialising the model
 * itself would run its appended attributes' queries.
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'username'            => $this->username,
            'email'               => $this->email,
            'mobile'              => $this->mobile,
            'telegram_chat_id'    => $this->telegram_chat_id,
            'gender'              => $this->gender,
            'gender_label'        => Helper::getGender($this->gender),
            'team'                => $this->team,
            'team_label'          => Helper::getTeam($this->team),
            'type'                => $this->type,
            'type_label'          => User::getUserType($this->type),
            'status'              => (int) $this->status,
            'enable_notification' => (int) $this->enable_notification,
        ];
    }
}
