export interface UploadedFile {
	id: string;
	name: string;
	type: FileType;
	content: string;
	size: number;
	uploadedAt: Date;
}

export enum FileType {
	PDF = 'pdf',
	TXT = 'txt',
	MD = 'md'
}

export const ACCEPTED_FILE_TYPES = {
	[FileType.PDF]: 'application/pdf',
	[FileType.TXT]: 'text/plain',
	[FileType.MD]: 'text/markdown'
} as const;

export const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

export function getFileTypeFromMime(mimeType: string, fileName: string): FileType | null {
	if (mimeType === 'application/pdf') return FileType.PDF;
	if (mimeType === 'text/plain') {
		// Check extension for .md files that might come as text/plain
		if (fileName.toLowerCase().endsWith('.md')) return FileType.MD;
		return FileType.TXT;
	}
	if (mimeType === 'text/markdown') return FileType.MD;

	// Fallback to extension check
	const ext = fileName.toLowerCase().split('.').pop();
	if (ext === 'pdf') return FileType.PDF;
	if (ext === 'txt') return FileType.TXT;
	if (ext === 'md') return FileType.MD;

	return null;
}
