import type { ReactNode } from 'react';
import BootstrapModal from 'react-bootstrap/Modal';

interface ModalProps {
    show: boolean;
    onHide: () => void;
    title: ReactNode;
    size?: 'sm' | 'lg' | 'xl';
    footer?: ReactNode;
    /** Let the body scroll instead of the page for long content. */
    scrollable?: boolean;
    children: ReactNode;
}

export default function Modal({ show, onHide, title, size, footer, scrollable = true, children }: ModalProps) {
    return (
        <BootstrapModal show={show} onHide={onHide} size={size} scrollable={scrollable} centered>
            <BootstrapModal.Header closeButton>
                <BootstrapModal.Title as="h6">{title}</BootstrapModal.Title>
            </BootstrapModal.Header>
            <BootstrapModal.Body className="custom-font-small">{children}</BootstrapModal.Body>
            {footer && <BootstrapModal.Footer>{footer}</BootstrapModal.Footer>}
        </BootstrapModal>
    );
}
