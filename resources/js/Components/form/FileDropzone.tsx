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
            <span className="file-dropzone__icon" aria-hidden="true">
                {busy ? (
                    <span className="spinner-border spinner-border-sm" />
                ) : (
                    <i className="mdi mdi-cloud-upload-outline" />
                )}
            </span>
            <span className="file-dropzone__text">
                {busy ? (
                    'Uploading…'
                ) : isDragActive ? (
                    'Drop the files here'
                ) : (
                    <>
                        <strong>Choose files</strong> or drop them here
                    </>
                )}
            </span>
            {hint && <span className="file-dropzone__hint">{hint}</span>}
        </div>
    );
}
