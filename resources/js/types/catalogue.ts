/** A product as App\Http\Resources\Catalogue\ProductResource sends it. */
export interface Product {
    id: number | null;
    sku: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    unit_price: number | null;
    is_halal?: boolean | null;
    base_monthly_qty?: number | null;
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

/** One product in a drink, per serve (RecipeController::present). */
export interface RecipeIngredient {
    product_id: number;
    name: string | null;
    unit: string | null;
    unit_price: number;
    is_halal: boolean | null;
    is_active: boolean;
    /** Per serve, in the product's unit (0.018 of a kg). */
    quantity: number;
    /** How a person reads it ("18 g"). */
    amount_label: string | null;
}

/** A drink made from catalogue products (RecipeController::present). */
export interface Recipe {
    id: number | null;
    name: string | null;
    slug: string | null;
    /** Other names a menu may use for it. */
    aliases: string[];
    /** The kind of drink (a key of RecipeOptions.categories). */
    category: string | null;
    description: string | null;
    serve: 'hot' | 'iced' | 'either';
    /** Business category ids. Empty means any. */
    outlet_types: number[];
    /** Customer group keys (area kinds). Empty means any. */
    customer_groups: string[];
    price_tier: string | null;
    is_active: boolean;
    /** Most outlets already serve it: an idea only when a menu shows it's missing. */
    everyday: boolean;
    /** Halal only when every ingredient is. */
    is_halal: boolean;
    cost_per_serve: number;
    ingredients: RecipeIngredient[];
}

/** A row of the drinks list. */
export interface RecipeRow extends Recipe {
    id: number;
    name: string;
    /** Outlets whose current menu has it. */
    on_menus: number;
}

/** Choices the drink pages offer. */
export interface RecipeOptions {
    serves: { value: string; label: string }[];
    categories: { value: string; label: string }[];
    customerGroups: { value: string; label: string }[];
    outletTypes: { value: number; label: string }[];
    priceTiers: { value: string; label: string }[];
    typeLabels: Record<number, string>;
}

/** One area type's rule on Admin > Drinks > Area rules (AreaRuleController::index()). */
export interface AreaRuleRow {
    kind: string;
    /** The area type's name, e.g. "University". */
    label: string;
    /** Its customer group, e.g. "Students". */
    customers: string | null;
    /** The kinds of place that make it up, in words. */
    places: string[];
    categories: string[];
    price_tiers: string[];
    note: string;
}

/** How the area is scored, from config ife.recommendation.area. */
export interface AreaScoring {
    radius: number;
    decay: number;
    /** Percent of the weighted places for Present and Some presence. */
    present: number;
    some: number;
}

/** A product offered as an ingredient on the drink form. */
export interface IngredientOption {
    value: number;
    label: string;
    category: string | null;
    unit: string;
    unit_price: number;
    is_halal: boolean | null;
}

/** An IFE area as App\Http\Resources\Catalogue\IfeAreaResource sends it. */
export interface IfeArea {
    id: number;
    area: string;
    description: string | null;
    leads_count: number;
    reports_count: number;
}

/** One part's fit (0 to 1) in the ideas check: the top ideas against two simple ways of picking drinks. */
export interface IdeasFit {
    outlets: number;
    engine: number | null;
    same_type: number | null;
    random: number | null;
}

/** How the drink ideas behave across every outlet (IdeasCheck on the server). */
export interface IdeasCheck {
    checked_at: string;
    outlets: number;
    with_ideas: number;
    ideas_per_outlet: number;
    drinks_suggested: number;
    drinks_active: number;
    top_drinks: { name: string; outlets: number; share: number }[];
    needs: IdeasFit & { changed: number | null };
    area: IdeasFit;
    answers: {
        pitched: number;
        accepted: number;
        declined: number;
        acceptance: number | null;
        /** Decline reason label => how many. */
        reasons: Record<string, number>;
    };
}
