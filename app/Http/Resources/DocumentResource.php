<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A file attached to a lead or task (DocumentUpload).
 *
 * @mixin \App\Models\DocumentUpload
 */
class DocumentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'filename'    => $this->filename,
            'name'        => $this->display_name,
            'uploaded_at' => (string) $this->created_at,
            'uploaded_by' => optional($this->uploadBy)->name,
            'size'        => $this->size,
            'url'         => $this->file_full_path,
        ];
    }
}
