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
            // The newest one is shown even when the 7:00 am run was missed, so the card can say it is old.
            'is_today'   => $this->digest_date->isToday(),
            'source'     => $this->source,
            'content'    => $this->content,
        ];
    }
}
