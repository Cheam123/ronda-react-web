/**
 * What kind of preview a file gets, from its extension.
 */

const AUDIO = new Set([
    '3gp', 'aa', 'aac', 'aax', 'act', 'aiff', 'alac', 'amr', 'au', 'awb', 'dvf', 'flac', 'gsm', 'iklax', 'ivs',
    'm4a', 'm4b', 'm4p', 'mmf', 'movpkg', 'mp3', 'mpc', 'msv', 'nmf', 'ogg', 'oga', 'mogg', 'opus', 'ra', 'rm',
    'raw', 'rf64', 'sln', 'tta', 'voc', 'vox', 'wav', 'wma', 'wv', '8svx', 'cda',
]);
const IMAGE = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']);
const VIDEO = new Set(['mp4', 'webm', 'mov']);

export type FileKind = 'image' | 'audio' | 'video' | 'pdf' | 'other';

export function extensionOf(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function fileKind(filename: string): FileKind {
    const extension = extensionOf(filename);
    if (IMAGE.has(extension)) return 'image';
    if (AUDIO.has(extension)) return 'audio';
    if (VIDEO.has(extension)) return 'video';
    if (extension === 'pdf') return 'pdf';
    return 'other';
}

/** 1536 -> "1.5 KB" */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
