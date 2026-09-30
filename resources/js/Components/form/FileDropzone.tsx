import clsx from 'clsx';
import { useDropzone, type Accept } from 'react-dropzone';

interface FileDropzoneProps {
    onFiles: (files: File[]) => void;
    accept?: Accept;
    /** Largest file allowed, in MB. */
    maxSizeMb?: number;
    maxFiles?: number;
    disabled?: boolean;
    /** Shown while an upload is in flight. */
    busy?: boolean;
    hint?: string;
    onReject?: (message: string) => void;
}

/** Drag-and-drop (or click) file picker; the caller decides when to upload. */
export default function FileDropzone({
    onFiles,
    accept,
    maxSizeMb = 10,
    maxFiles = 25,
    disabled = false,
    busy = false,
    hint,
    onReject,
}: FileDropzoneProps) {
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept,
        maxFiles,
        maxSize: maxSizeMb * 1024 * 1024,
        multiple: maxFiles > 1,
        disabled: disabled || busy,
        onDrop: (accepted, rejected) => {
            if (rejected.length > 0) {
                const names = rejected.map((rejection) => rejection.file.name).join(', ');
                onReject?.(`Not uploaded (wrong type or larger than ${maxSizeMb} MB): ${names}`);
            }
            if (accepted.length > 0) {
                onFiles(accepted);
            }
        },
    });

    return (
        <div {...getRootProps({ className: clsx('file-dropzone', { 'is-active': isDragActive, 'is-busy': busy }) })}>
            <input {...getInputProps()} />
            {busy ? (
                <span>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Uploading...
                </span>
            ) : (
                <span>
                    <i className="mdi mdi-cloud-upload-outline me-1" />
                    {isDragActive ? 'Drop the files here' : 'Drop files here or click to upload'}
                </span>
            )}
            {hint && <div className="custom-font-xxsmall text-muted mt-1">{hint}</div>}
        </div>
    );
}
