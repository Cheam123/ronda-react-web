import { router, usePage } from '@inertiajs/react';
import clsx from 'clsx';
import { useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { formatMoney, pluralize } from '@/lib/format';
import type { PageProps } from '@/types';
import type { Product } from '@/types/catalogue';

export type RetiringProduct = Required<Pick<Product, 'order_lines_count'>> &
    Pick<Product, 'category' | 'unit' | 'unit_price' | 'is_active'> & {
        id: number;
        name: string;
        sku: string;
    };

interface RetireDialogProps {
    /** The product to take out of the catalogue; null closes the dialog. */
    product: RetiringProduct | null;
    /** Outlets it is recommended to right now. */
    recommendedCount: number;
    onClose: () => void;
}

/**
 * Deactivate a product that is on orders, or delete one that never was
 * (ProductController::delete decides the same way). Says what will change
 * before anything does.
 */
export default function RetireDialog({ product, recommendedCount, onClose }: RetireDialogProps) {
    const { currency } = usePage<PageProps>().props.app;
    const [processing, setProcessing] = useState(false);

    // Keep showing the last product while the dialog fades out.
    const last = useRef(product);
    if (product) last.current = product;
    const shown = last.current;

    if (!shown) {
        return null;
    }

    const onOrders = shown.order_lines_count > 0;

    const confirm = () => {
        router.post(
            route('product.delete'),
            { id: shown.id },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => {
                    setProcessing(false);
                    onClose();
                },
            },
        );
    };

    return (
        <Modal
            show={product !== null}
            onHide={onClose}
            centered
            dialogClassName="rd-dialog"
            aria-labelledby="retire-title"
        >
            <div className="rd-dialog__body">
                <div className="rd-dialog__head">
                    <span className={clsx('rd-icon rd-icon--lg', onOrders ? 'rd-icon--serious' : 'rd-icon--critical')}>
                        <i
                            className={`mdi ${onOrders ? 'mdi-archive-outline' : 'mdi-delete-outline'}`}
                            aria-hidden="true"
                        />
                    </span>
                    <div className="flex-grow-1">
                        <h2 id="retire-title" className="rd-dialog__title">
                            {onOrders ? `Deactivate ${shown.name}?` : `Delete ${shown.name}?`}
                        </h2>
                        <p className="rd-dialog__text">
                            {onOrders ? (
                                <>
                                    It is on <strong>{pluralize(shown.order_lines_count, 'order line')}</strong>, so it
                                    can&apos;t be deleted. Deactivating hides it but keeps your order history whole.
                                </>
                            ) : (
                                'It has never been ordered, so it can be deleted. It will leave the catalogue for good.'
                            )}
                        </p>
                    </div>
                    <button type="button" className="rd-btn rd-btn--icon" aria-label="Close" onClick={onClose}>
                        <i className="mdi mdi-close" aria-hidden="true" />
                    </button>
                </div>

                {onOrders ? (
                    <div className="rd-dialog__box">
                        <span className="rd-label">What changes</span>
                        <ul className="rd-checks">
                            <li>
                                <i className="mdi mdi-close is-bad" aria-hidden="true" />
                                Removed from the order form in the mobile app
                            </li>
                            <li>
                                <i className="mdi mdi-close is-bad" aria-hidden="true" />
                                {recommendedCount > 0
                                    ? `No longer recommended. ${pluralize(recommendedCount, 'outlet loses', 'outlets lose')} it at the next refresh.`
                                    : 'No longer recommended to outlets'}
                            </li>
                            <li>
                                <i className="mdi mdi-check is-good" aria-hidden="true" />
                                Stays on past orders and in sales figures
                            </li>
                            <li>
                                <i className="mdi mdi-check is-good" aria-hidden="true" />
                                You can reactivate it any time from Products
                            </li>
                        </ul>
                    </div>
                ) : (
                    <div className="rd-dialog__box">
                        <div className="d-flex align-items-center justify-content-between gap-3">
                            <span className="d-flex flex-column" style={{ minWidth: 0 }}>
                                <span className="fw-semibold">{shown.name}</span>
                                <span className="rd-mono rd-muted" style={{ fontSize: 11 }}>
                                    {shown.sku}
                                    {shown.category && ` · ${shown.category}`} &middot; {currency}{' '}
                                    {formatMoney(shown.unit_price)} / {shown.unit}
                                </span>
                            </span>
                            <span className="rd-chip">0 order lines</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="rd-dialog__foot">
                <button type="button" className="rd-btn" onClick={onClose}>
                    Cancel
                </button>
                <button type="button" className="rd-btn rd-btn--danger" onClick={confirm} disabled={processing}>
                    {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                    {onOrders ? 'Deactivate product' : 'Delete product'}
                </button>
            </div>
        </Modal>
    );
}
