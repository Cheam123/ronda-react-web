import BootstrapModal from 'react-bootstrap/Modal';

interface ImageLightboxProps {
    /** The image to show; null closes the lightbox. */
    src: string | null;
    caption?: string;
    onClose: () => void;
}

/** Full-screen preview for a photo attachment. */
export default function ImageLightbox({ src, caption, onClose }: ImageLightboxProps) {
    return (
        <BootstrapModal show={src !== null} onHide={onClose} size="xl" centered contentClassName="image-lightbox">
            <BootstrapModal.Header closeButton closeVariant="white" className="border-0" />
            <BootstrapModal.Body className="text-center pt-0">
                {src && <img src={src} alt={caption ?? 'Attachment'} className="image-lightbox__img" />}
                {caption && <div className="image-lightbox__caption">{caption}</div>}
                {src && (
                    <a href={src} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light mt-2">
                        <i className="mdi mdi-open-in-new me-1" />
                        Open original
                    </a>
                )}
            </BootstrapModal.Body>
        </BootstrapModal>
    );
}
