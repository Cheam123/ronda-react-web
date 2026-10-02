import { extensionOf, formatFileSize } from '@/lib/files';

interface PendingFilesProps {
    files: File[];
    onRemove: (index: number) => void;
}

/** Files picked on a new record's form, not uploaded until it is saved. */
export default function PendingFiles({ files, onRemove }: PendingFilesProps) {
    if (files.length === 0) {
        return null;
    }

    return (
        <ul className="rd-docs">
            {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="rd-docs__item">
                    <span className="rd-docs__type" aria-hidden="true">
                        {extensionOf(file.name).slice(0, 4).toUpperCase() || 'FILE'}
                    </span>
                    <span className="rd-docs__text">
                        <span className="rd-docs__name">{file.name}</span>
                        <span className="rd-docs__meta">{formatFileSize(file.size)} · uploads when you save</span>
                    </span>
                    <button
                        type="button"
                        className="rd-btn rd-btn--icon rd-btn--icon-danger"
                        aria-label={`Remove ${file.name}`}
                        title="Remove"
                        onClick={() => onRemove(index)}
                    >
                        <i className="mdi mdi-close" aria-hidden="true" />
                    </button>
                </li>
            ))}
        </ul>
    );
}
