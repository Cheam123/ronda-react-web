import { fileItems } from '@/lib/forms/schema';

interface FileAnswerListProps {
    value: unknown;
    /** Opens an image in the lightbox. */
    onImageClick?: (src: string) => void;
}

/** A file answer: images as zoomable thumbnails, other files as links. */
export default function FileAnswerList({ value, onImageClick }: FileAnswerListProps) {
    return (
        <div className="file-answers">
            {fileItems(value).map((file, index) =>
                file.image ? (
                    <button
                        key={`${file.url}-${index}`}
                        type="button"
                        className="file-answers__thumb"
                        title="Click to zoom"
                        onClick={() => onImageClick?.(file.url)}
                    >
                        <img src={file.url} alt={file.name} />
                    </button>
                ) : file.linkable ? (
                    <a
                        key={`${file.url}-${index}`}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="file-answers__chip"
                    >
                        <i className="mdi mdi-file-outline me-1" />
                        {file.name}
                        <i className="mdi mdi-open-in-new ms-1" />
                    </a>
                ) : (
                    <span key={`${file.url}-${index}`} className="file-answers__chip">
                        <i className="mdi mdi-file-outline me-1" />
                        {file.name}
                    </span>
                ),
            )}
        </div>
    );
}
