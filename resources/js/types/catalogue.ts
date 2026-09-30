/** A product as App\Http\Resources\Catalogue\ProductResource sends it. */
export interface Product {
    id: number | null;
    sku: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    unit_price: number | null;
    description: string | null;
    is_active: boolean;
    /** Present when the list counted it. */
    order_lines_count?: number;
}

/** An IFE area as App\Http\Resources\Catalogue\IfeAreaResource sends it. */
export interface IfeArea {
    id: number;
    area: string;
    description: string | null;
    leads_count: number;
    reports_count: number;
}
