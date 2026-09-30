import Select, { type OptionGroup } from '@/Components/form/Select';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/types/catalogue';

export interface OrderLine {
    product_id: string;
    quantity: string;
}

interface OrderLineRowProps {
    line: OrderLine;
    product: Product | undefined;
    productGroups: OptionGroup[];
    onChange: (line: OrderLine) => void;
    onRemove: () => void;
}

/** One product line: pick a product and quantity; price comes from the catalogue. */
export default function OrderLineRow({ line, product, productGroups, onChange, onRemove }: OrderLineRowProps) {
    const quantity = Number(line.quantity) || 0;
    const price = product?.unit_price ?? 0;

    return (
        <tr>
            <td>
                <Select
                    aria-label="Product"
                    placeholder="-- Select product --"
                    groups={productGroups}
                    value={line.product_id}
                    onChange={(event) => onChange({ ...line, product_id: event.target.value })}
                />
            </td>
            <td>
                <div className="input-group input-group-sm">
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        aria-label="Quantity"
                        className="form-control"
                        value={line.quantity}
                        onChange={(event) => onChange({ ...line, quantity: event.target.value })}
                    />
                    <span className="input-group-text">{product?.unit ?? ''}</span>
                </div>
            </td>
            <td className="num">{product ? formatMoney(price) : ''}</td>
            <td className="num">{product && quantity > 0 ? formatMoney(price * quantity) : ''}</td>
            <td>
                <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Remove" onClick={onRemove}>
                    <i className="fas fa-times" />
                </button>
            </td>
        </tr>
    );
}
