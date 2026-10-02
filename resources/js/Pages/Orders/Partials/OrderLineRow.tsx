import SearchSelect from '@/Components/form/SearchSelect';
import type { OptionGroup } from '@/Components/form/Select';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/types/catalogue';

export interface OrderLine {
    product_id: string;
    quantity: string;
}

interface OrderLineRowProps {
    line: OrderLine;
    /** Its 1-based place, for the screen reader labels. */
    number: number;
    product: Product | undefined;
    productGroups: OptionGroup[];
    onChange: (line: OrderLine) => void;
    onRemove: () => void;
}

/** One product line: pick a product and quantity; price comes from the catalogue. */
export default function OrderLineRow({ line, number, product, productGroups, onChange, onRemove }: OrderLineRowProps) {
    const quantity = Number(line.quantity) || 0;
    const price = product?.unit_price ?? 0;

    return (
        <tr>
            <td>
                <SearchSelect
                    ariaLabel={`Product on line ${number}`}
                    placeholder="Choose a product"
                    options={[]}
                    groups={productGroups}
                    value={line.product_id}
                    onChange={(value) => onChange({ ...line, product_id: value })}
                />
            </td>
            <td>
                <div className="rd-affix rd-affix--full order-lines__qty">
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        aria-label={`Quantity on line ${number}`}
                        value={line.quantity}
                        onChange={(event) => onChange({ ...line, quantity: event.target.value })}
                    />
                    {product?.unit && <span className="rd-affix__end">{product.unit}</span>}
                </div>
            </td>
            <td className="num">{product ? formatMoney(price) : <span className="rd-muted">—</span>}</td>
            <td className="num order-lines__total">
                {product && quantity > 0 ? formatMoney(price * quantity) : <span className="rd-muted">—</span>}
            </td>
            <td className="rd-col-actions">
                <button
                    type="button"
                    className="rd-btn rd-btn--icon rd-btn--icon-danger"
                    aria-label={`Remove line ${number}`}
                    title="Remove"
                    onClick={onRemove}
                >
                    <i className="mdi mdi-close" aria-hidden="true" />
                </button>
            </td>
        </tr>
    );
}
