import clsx from 'clsx';
import { FieldProvider } from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import type { OptionGroup } from '@/Components/form/Select';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/types/catalogue';

export interface OrderLine {
    product_id: string;
    quantity: string;
    /** Started from the outlet's suggested orders; not posted. */
    suggested?: boolean;
}

interface OrderLineRowProps {
    line: OrderLine;
    /** Its 0-based place: the server's error keys ("lines.0.quantity") and the field ids. */
    index: number;
    product: Product | undefined;
    productGroups: OptionGroup[];
    errors: { product?: string; quantity?: string };
    currency: string;
    onChange: (line: OrderLine) => void;
    onRemove: () => void;
}

/** One product line: pick a product and quantity; price comes from the catalogue. Phones show it as a card. */
export default function OrderLineRow({
    line,
    index,
    product,
    productGroups,
    errors,
    currency,
    onChange,
    onRemove,
}: OrderLineRowProps) {
    const number = index + 1;
    const quantity = Number(line.quantity) || 0;
    const price = product?.unit_price ?? 0;
    const productId = `lines-${index}-product_id`;
    const quantityId = `lines-${index}-quantity`;

    return (
        <tr className={clsx((errors.product || errors.quantity) && 'has-error')}>
            <td className="rd-cell-main order-lines__product">
                <FieldProvider
                    value={{
                        invalid: Boolean(errors.product),
                        describedBy: errors.product ? `${productId}-error` : undefined,
                        errorId: errors.product ? `${productId}-error` : undefined,
                    }}
                >
                    <SearchSelect
                        id={productId}
                        ariaLabel={`Product on line ${number}`}
                        placeholder="Choose a product"
                        options={[]}
                        groups={productGroups}
                        value={line.product_id}
                        onChange={(value) => onChange({ ...line, product_id: value, suggested: false })}
                    />
                </FieldProvider>
                {line.suggested && <span className="order-lines__suggested">Suggested</span>}
                {errors.product && <LineError id={`${productId}-error`}>{errors.product}</LineError>}
            </td>
            <td className="order-lines__quantity" data-label="Quantity">
                <div className={clsx('rd-affix rd-affix--full order-lines__qty', errors.quantity && 'is-invalid')}>
                    <input
                        id={quantityId}
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        aria-label={`Quantity on line ${number}`}
                        aria-invalid={errors.quantity ? true : undefined}
                        aria-describedby={errors.quantity ? `${quantityId}-error` : undefined}
                        value={line.quantity}
                        onChange={(event) => onChange({ ...line, quantity: event.target.value })}
                    />
                    {product?.unit && <span className="rd-affix__end">{product.unit}</span>}
                </div>
                {errors.quantity && <LineError id={`${quantityId}-error`}>{errors.quantity}</LineError>}
            </td>
            <td className="num order-lines__price" data-label={`Unit price (${currency})`}>
                {product ? formatMoney(price) : <span className="rd-muted">—</span>}
            </td>
            <td className="num order-lines__total" data-label={`Line total (${currency})`}>
                {product && quantity > 0 ? formatMoney(price * quantity) : <span className="rd-muted">—</span>}
            </td>
            <td className="rd-col-actions order-lines__remove">
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

function LineError({ id, children }: { id: string; children: string }) {
    return (
        <span className="rd-field__error" id={id}>
            <i className="mdi mdi-alert-circle-outline" aria-hidden="true" />
            {children}
        </span>
    );
}
