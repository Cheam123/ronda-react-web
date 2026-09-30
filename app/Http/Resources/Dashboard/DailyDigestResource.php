<?php

namespace App\Http\Resources\Dashboard;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The Morning Round-Up card.
 *
 * @mixin \App\Models\DailyDigest
 */
class DailyDigestResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'date_label' => $this->digest_date->format('l, j M Y'),
            'source'     => $this->source,
            'content'    => $this->content,
        ];
    }
}
