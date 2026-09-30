/** A file attached to a lead or task (App\\Http\\Resources\\DocumentResource). */
export interface DocumentFile {
    id: number;
    /** The stored file name, with its extension. */
    filename: string;
    /** The name it was uploaded with. */
    name: string;
    uploaded_at: string;
    uploaded_by: string | null;
    /** In KB. */
    size: number;
    url: string;
}
