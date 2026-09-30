<?php

namespace App\Http\Resources\Catalogue;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A catalogue product.
 *
 * @mixin \App\Models\Product
 */
class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                => $this->id,
            'sku'               => $this->sku,
            'name'              => $this->name,
            'category'          => $this->category,
            'unit'              => $this->unit,
            'unit_price'        => $this->unit_price,
            'description'       => $this->description,
            'is_active'         => (bool) $this->is_active,
            'order_lines_count' => $this->whenCounted('orderLines'),
        ];
    }
}
