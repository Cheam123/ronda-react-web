<?php

namespace App\Http\Resources\Forms;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A form as a row of the form list or a card on the "start a form" page.
 *
 * @mixin \App\Models\Form
 */
class FormSummaryResource extends JsonResource
{
    public function toArray($request): array
    {
        $elements = $this->form_elements['elements'] ?? $this->form_elements ?? [];

        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'description' => $this->description,
            'is_enabled'  => (bool) ($this->is_enabled ?? true),
            'created_at'  => optional($this->created_at)->format('d M Y'),
            'field_count' => is_array($elements) ? count($elements) : 0,
        ];
    }
}
