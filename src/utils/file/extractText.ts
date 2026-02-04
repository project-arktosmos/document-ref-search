import { browser } from '$app/environment';
import { base } from '$app/paths';
import { FileType, getFileTypeFromMime } from '$types/file.type';

export async function extractTextFromFile(file: File): Promise<string> {
	const fileType = getFileTypeFromMime(file.type, file.name);

	if (!fileType) {
		throw new Error(`Unsupported file type: ${file.type}`);
	}

	switch (fileType) {
		case FileType.PDF:
			return extractTextFromPdf(file);
		case FileType.TXT:
		case FileType.MD:
			return extractTextFromTextFile(file);
		default:
			throw new Error(`Unsupported file type: ${fileType}`);
	}
}

async function extractTextFromTextFile(file: File): Promise<string> {
	return file.text();
}

async function extractTextFromPdf(file: File): Promise<string> {
	if (!browser) {
		throw new Error('PDF extraction is only available in the browser');
	}

	// Dynamic import to avoid SSR issues
	const pdfjsLib = await import('pdfjs-dist');

	// Use local worker to avoid CORS issues
	pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;

	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

	const textParts: string[] = [];

	for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
		const page = await pdf.getPage(pageNum);
		const textContent = await page.getTextContent();
		const pageText = textContent.items
			.map((item) => ('str' in item ? item.str : ''))
			.join(' ');
		textParts.push(pageText);
	}

	return textParts.join('\n\n');
}
