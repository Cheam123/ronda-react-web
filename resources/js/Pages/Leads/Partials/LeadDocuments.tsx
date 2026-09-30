import { router } from '@inertiajs/react';
import DataTable, { EmptyRow } from '@/Components/ui/DataTable';
import { confirm } from '@/lib/dialogs';
import { fileKind } from '@/lib/files';
import type { LeadDocument } from '@/types/leads';

interface LeadDocumentsProps {
    documents: LeadDocument[];
    /** Show inline audio players and preview buttons (the View page). */
    previews?: boolean;
    /** Offer a delete button per file (the Edit page). */
    deletable?: boolean;
}

function Preview({ document }: { document: LeadDocument }) {
    switch (fileKind(document.filename)) {
        case 'audio':
            return (
                <audio controls className="custom-shadow" src={document.url}>
                    Your browser does not support the audio element.
                </audio>
            );
        case 'image':
            return (
                <a href={document.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light">
                    Preview photo
                </a>
            );
        case 'pdf':
            return (
                <a href={document.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-light">
                    Preview PDF
                </a>
            );
        default:
            return null;
    }
}

/** The files attached to a lead. */
export default function LeadDocuments({ documents, previews = false, deletable = false }: LeadDocumentsProps) {
    const remove = async (document: LeadDocument) => {
        if (await confirm({ title: 'Are you sure to delete?', text: document.name, icon: 'warning', danger: true })) {
            router.get(route('lead.file.delete', { doc_id: document.id }), {}, { preserveScroll: true });
        }
    };

    return (
        <DataTable>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Upload Date</th>
                    <th>Upload By</th>
                    <th>File Size</th>
                    {previews && <th />}
                    <th />
                </tr>
            </thead>
            <tbody>
                {documents.map((document) => (
                    <tr key={document.id}>
                        <td>{document.filename}</td>
                        <td>{document.uploaded_at}</td>
                        <td>{document.uploaded_by}</td>
                        <td>{document.size} KB</td>
                        {previews && (
                            <td className="text-center">
                                <Preview document={document} />
                            </td>
                        )}
                        <td className="text-center text-nowrap">
                            <a href={route('lead.file.download', { doc_id: document.id })} title="Download">
                                <i className="fas fa-cloud-download-alt fa-lg" />
                            </a>
                            {deletable && (
                                <button
                                    type="button"
                                    className="btn btn-link p-0 ms-2 text-danger"
                                    title="Delete"
                                    onClick={() => remove(document)}
                                >
                                    <i className="fas fa-trash-alt fa-lg" />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
                {documents.length === 0 && <EmptyRow colSpan={previews ? 6 : 5}>No documents uploaded.</EmptyRow>}
            </tbody>
        </DataTable>
    );
}
