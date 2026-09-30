<?php

namespace App\Http\Resources\Forms;

use App\Services\FormSchemaService;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One section of a record's answers, as FormController::buildResponseSections()
 * lays them out: ['label' => ?string, 'fields' => [['element' => ?array, 'answer' => array]]].
 *
 * Each field carries what the page needs to show it without the schema: its
 * type and label (the current element's, falling back to the answer's own for
 * legacy rows), a checkbox's full option list, and a Person answer's names.
 */
class ResponseSectionResource extends JsonResource
{
    public function toArray($request): array
    {
        $schema = app(FormSchemaService::class);

        return [
            'label'  => $this->resource['label'] ?? null,
            'fields' => collect($this->resource['fields'] ?? [])->map(function ($field) use ($schema) {
                $element = $field['element'] ?? null;
                $answer  = $field['answer'] ?? [];
                $type    = $element['type'] ?? ($answer['type'] ?? 'text');
                $value   = $answer['value'] ?? null;

                return [
                    'id'         => $answer['id'] ?? ($element['id'] ?? null),
                    'type'       => $type,
                    'label'      => $element['label'] ?? ($answer['label'] ?? 'Field'),
                    'value'      => $value,
                    'options'    => $type === 'checkbox'
                        ? array_values(array_filter($element['values'] ?? [], fn ($option) => $option && is_scalar($option)))
                        : null,
                    'user_label' => $type === 'user' ? $schema->userLabel($value) : null,
                ];
            })->values()->all(),
        ];
    }
}
