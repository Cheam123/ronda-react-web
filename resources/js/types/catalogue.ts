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

/** A row of the catalogue list: the product and how it sold (ProductController::index). */
export interface ProductRow extends Product {
    id: number;
    sku: string;
    name: string;
    unit: string;
    unit_price: number;
    order_lines_count: number;
    /** Quantity and value on confirmed orders, last 30 days. */
    sold_qty: number;
    sold_value: number;
    /** Outlets that ordered it in the last 30 days. */
    outlets: number;
    /** Active, in the catalogue 90 days, and not ordered in that time. */
    stale: boolean;
    /** Outlets it is recommended to right now. */
    recommended_count: number;
}

/** Products per category, for the catalogue tabs (null: no category). */
export interface CategoryCount {
    name: string | null;
    count: number;
}

/** A category offered on the product form, with its price range. */
export interface CategoryOption {
    name: string;
    count: number;
    min_price: number;
    max_price: number;
}

/** An IFE area as App\Http\Resources\Catalogue\IfeAreaResource sends it. */
export interface IfeArea {
    id: number;
    area: string;
    description: string | null;
    leads_count: number;
    reports_count: number;
}
