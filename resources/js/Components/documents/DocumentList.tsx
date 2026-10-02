import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { confirm } from '@/lib/dialogs';
import { extensionOf, fileKind, formatFileSize } from '@/lib/files';
import type { DocumentFile } from '@/types/documents';

interface DocumentListProps {
    documents: DocumentFile[];
    /** Offer a delete button per file (the Edit page). */
    deletable?: boolean;
    empty?: string;
}

/** A lead's files as rows: type, name (opens it), size and date, download and delete. */
export default function DocumentList({ documents, deletable = false, empty = 'No documents yet.' }: DocumentListProps) {
    const remove = async (document: DocumentFile) => {
        if (await confirm({ title: 'Delete this file?', text: document.name, icon: 'warning', danger: true })) {
            router.get(
                route('lead.file.delete', { doc_id: document.id }),
                {},
                { preserveScroll: true, preserveState: true },
            );
        }
    };

    if (documents.length === 0) {
        return <p className="rd-docs__empty">{empty}</p>;
    }

    return (
        <ul className="rd-docs">
            {documents.map((document) => {
                const kind = fileKind(document.filename);
                const label = document.name || document.filename;

                return (
                    <li key={document.id} className="rd-docs__item">
                        <span className={clsx('rd-docs__type', `rd-docs__type--${kind}`)} aria-hidden="true">
                            {extensionOf(document.filename).slice(0, 4).toUpperCase() || 'FILE'}
                        </span>
                        <span className="rd-docs__text">
                            <a href={document.url} target="_blank" rel="noopener noreferrer" className="rd-docs__name">
                                {label}
                            </a>
                            <span className="rd-docs__meta">
                                {[formatFileSize(document.size * 1024), document.uploaded_at, document.uploaded_by]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                            {kind === 'audio' && (
                                <audio controls preload="none" src={document.url} className="rd-docs__audio">
                                    Your browser cannot play this recording.
                                </audio>
                            )}
                        </span>
                        <a
                            href={route('lead.file.download', { doc_id: document.id })}
                            className="rd-btn rd-btn--icon"
                            aria-label={`Download ${label}`}
                            title="Download"
                        >
                            <i className="mdi mdi-download" aria-hidden="true" />
                        </a>
                        {deletable && (
                            <button
                                type="button"
                                className="rd-btn rd-btn--icon rd-btn--icon-danger"
                                aria-label={`Delete ${label}`}
                                title="Delete"
                                onClick={() => remove(document)}
                            >
                                <i className="mdi mdi-trash-can-outline" aria-hidden="true" />
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
