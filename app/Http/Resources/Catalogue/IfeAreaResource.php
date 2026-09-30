<?php

namespace App\Http\Resources\Catalogue;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An IFE area with how many leads and visit reports are filed under it.
 *
 * @mixin \App\Models\IfeArea
 */
class IfeAreaResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'area'          => $this->area,
            'description'   => $this->description,
            'leads_count'   => (int) $this->leads_count,
            'reports_count' => (int) $this->reports_count,
        ];
    }
}
