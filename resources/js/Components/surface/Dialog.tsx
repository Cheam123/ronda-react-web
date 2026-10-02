import clsx from 'clsx';
import { useId, type ReactNode } from 'react';
import Modal from 'react-bootstrap/Modal';

interface DialogProps {
    show: boolean;
    onHide: () => void;
    title: string;
    /** A line or two under the title. */
    text?: ReactNode;
    /** An icon in a tinted square beside the title (mdi name, "mdi-check"). */
    icon?: string;
    tone?: 'good' | 'serious' | 'critical' | 'neutral';
    /** Wide for an editor (branch conditions). */
    wide?: boolean;
    /** The buttons, right-aligned on the grey foot. */
    footer: ReactNode;
    children?: ReactNode;
}

/** A surface dialog (react-bootstrap Modal drawn with .rd-dialog): title, body, buttons. */
export default function Dialog({ show, onHide, title, text, icon, tone, wide = false, footer, children }: DialogProps) {
    const titleId = useId();

    return (
        <Modal
            show={show}
            onHide={onHide}
            centered
            dialogClassName={clsx('rd-dialog', wide && 'rd-dialog--wide')}
            aria-labelledby={titleId}
        >
            <div className="rd-dialog__body">
                <div className="rd-dialog__head">
                    {icon && (
                        <span className={clsx('rd-icon rd-icon--lg', tone && `rd-icon--${tone}`)}>
                            <i className={`mdi ${icon}`} aria-hidden="true" />
                        </span>
                    )}
                    <div className="flex-grow-1">
                        <h2 id={titleId} className="rd-dialog__title">
                            {title}
                        </h2>
                        {text && <div className="rd-dialog__text">{text}</div>}
                    </div>
                    <button type="button" className="rd-btn rd-btn--icon" aria-label="Close" onClick={onHide}>
                        <i className="mdi mdi-close" aria-hidden="true" />
                    </button>
                </div>
                {children}
            </div>
            <div className="rd-dialog__foot">{footer}</div>
        </Modal>
    );
}
