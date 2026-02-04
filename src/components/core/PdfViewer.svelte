<script lang="ts">
	import classNames from 'classnames';
	import { onDestroy } from 'svelte';
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import type { TextItem } from 'pdfjs-dist/types/src/display/api';

	export let file: File | null = null;
	export let highlightQuery: string = '';
	export let highlightCaseSensitive: boolean = false;
	export let highlightWholeWord: boolean = false;
	export let highlightContextLength: number = 50;
	export let classes: string = '';

	let canvasContainer: HTMLDivElement;
	let pdfDoc: PDFDocumentProxy | null = null;
	let currentPage = 1;
	let totalPages = 0;
	let scale = 1.0;
	let isLoading = false;

	interface TextItemWithPosition {
		str: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}

	$: wrapperClasses = classNames('w-full rounded-lg overflow-hidden bg-base-200', classes);

	async function loadPdf(pdfFile: File) {
		isLoading = true;

		try {
			const pdfjsLib = await import('pdfjs-dist');
			pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

			const arrayBuffer = await pdfFile.arrayBuffer();
			pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
			totalPages = pdfDoc.numPages;
			currentPage = 1;

			await renderPage(currentPage);
		} catch (err) {
			console.error('Failed to load PDF:', err);
		} finally {
			isLoading = false;
		}
	}

	async function renderPage(pageNum: number) {
		if (!pdfDoc || !canvasContainer) return;

		const page = await pdfDoc.getPage(pageNum);
		const viewport = page.getViewport({ scale });

		// Clear previous content
		canvasContainer.innerHTML = '';

		// Create wrapper for positioning
		const pageWrapper = document.createElement('div');
		pageWrapper.className = 'relative mx-auto';
		pageWrapper.style.width = `${viewport.width}px`;
		pageWrapper.style.height = `${viewport.height}px`;

		// Create canvas for PDF rendering
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		if (!context) return;

		canvas.height = viewport.height;
		canvas.width = viewport.width;
		canvas.className = 'absolute top-0 left-0';

		pageWrapper.appendChild(canvas);

		// Create highlight overlay canvas
		const highlightCanvas = document.createElement('canvas');
		const highlightContext = highlightCanvas.getContext('2d');
		if (!highlightContext) return;

		highlightCanvas.height = viewport.height;
		highlightCanvas.width = viewport.width;
		highlightCanvas.className = 'absolute top-0 left-0 pointer-events-none';

		pageWrapper.appendChild(highlightCanvas);
		canvasContainer.appendChild(pageWrapper);

		// Render PDF
		await page.render({
			canvasContext: context,
			viewport
		}).promise;

		// Get text content and apply highlights
		const textContent = await page.getTextContent();
		const textItems: TextItemWithPosition[] = [];

		for (const item of textContent.items) {
			if ('str' in item && item.str) {
				const textItem = item as TextItem;
				const tx = textItem.transform;
				// Transform matrix: [a, b, c, d, e, f]
				// | a  b  0 |
				// | c  d  0 |
				// | e  f  1 |

				// Calculate font height from transform (handles rotation)
				// Vertical scaling factor = sqrt(c² + d²)
				const fontHeight = Math.hypot(tx[2], tx[3]);

				// Get the position in PDF coordinates
				const pdfX = tx[4];
				const pdfY = tx[5];

				// Convert to viewport coordinates using the viewport transform
				const vt = viewport.transform;
				const x = vt[0] * pdfX + vt[2] * pdfY + vt[4];
				const y = vt[1] * pdfX + vt[3] * pdfY + vt[5];

				// Scale width and height to viewport
				const width = textItem.width * scale;
				const height = fontHeight * scale;

				// Use textItem.height if available (PDF.js provides this)
				const finalHeight = textItem.height ? textItem.height * scale : height;

				// Add small padding to ensure highlight covers text
				const padding = finalHeight * 0.15;

				textItems.push({
					str: textItem.str,
					x,
					y: y - finalHeight - padding,
					width,
					height: finalHeight + padding * 2
				});
			}
		}

		applyHighlights(highlightContext, textItems);
	}

	function escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function drawHighlightRange(
		ctx: CanvasRenderingContext2D,
		textItems: TextItemWithPosition[],
		charToItem: { itemIndex: number; charIndex: number }[],
		startPos: number,
		endPos: number,
		color: string
	) {
		if (startPos >= charToItem.length || startPos >= endPos) return;

		const clampedStart = Math.max(0, startPos);
		const clampedEnd = Math.min(endPos, charToItem.length);

		if (clampedStart >= clampedEnd) return;

		const startMapping = charToItem[clampedStart];
		const endMapping = charToItem[clampedEnd - 1];

		ctx.fillStyle = color;

		for (let i = startMapping.itemIndex; i <= endMapping.itemIndex; i++) {
			const item = textItems[i];

			let rectX = item.x;
			let rectWidth = item.width;

			// If this is the first item, adjust start position
			if (i === startMapping.itemIndex && startMapping.charIndex > 0) {
				const charWidth = item.width / item.str.length;
				rectX += charWidth * startMapping.charIndex;
				rectWidth -= charWidth * startMapping.charIndex;
			}

			// If this is the last item, adjust end position
			if (i === endMapping.itemIndex && endMapping.charIndex < item.str.length - 1) {
				const charWidth = item.width / item.str.length;
				rectWidth =
					charWidth *
					(endMapping.charIndex - (i === startMapping.itemIndex ? startMapping.charIndex : 0) + 1);
			}

			ctx.fillRect(rectX, item.y, rectWidth, item.height);
		}
	}

	function applyHighlights(ctx: CanvasRenderingContext2D, textItems: TextItemWithPosition[]) {
		if (!highlightQuery.trim() || textItems.length === 0) return;

		// Build full text with position mapping
		let fullText = '';
		const charToItem: { itemIndex: number; charIndex: number }[] = [];

		for (let i = 0; i < textItems.length; i++) {
			const item = textItems[i];
			for (let j = 0; j < item.str.length; j++) {
				charToItem.push({ itemIndex: i, charIndex: j });
			}
			fullText += item.str;
		}

		// Find matches
		let searchQuery = highlightWholeWord
			? `\\b${escapeRegExp(highlightQuery)}\\b`
			: escapeRegExp(highlightQuery);

		const flags = highlightCaseSensitive ? 'g' : 'gi';
		const regex = new RegExp(searchQuery, flags);
		let match: RegExpExecArray | null;

		const matches: { start: number; end: number }[] = [];
		while ((match = regex.exec(fullText)) !== null) {
			matches.push({ start: match.index, end: match.index + match[0].length });
			if (matches.length >= 500) break;
		}

		const yellowColor = 'rgba(250, 204, 21, 0.4)';
		const redColor = 'rgba(239, 68, 68, 0.5)';

		// First pass: draw yellow context highlights
		for (const m of matches) {
			const contextStart = Math.max(0, m.start - highlightContextLength);
			const contextEnd = Math.min(fullText.length, m.end + highlightContextLength);

			// Draw context before match
			if (contextStart < m.start) {
				drawHighlightRange(ctx, textItems, charToItem, contextStart, m.start, yellowColor);
			}

			// Draw context after match
			if (m.end < contextEnd) {
				drawHighlightRange(ctx, textItems, charToItem, m.end, contextEnd, yellowColor);
			}
		}

		// Second pass: draw red match highlights (on top)
		for (const m of matches) {
			drawHighlightRange(ctx, textItems, charToItem, m.start, m.end, redColor);
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
			renderPage(currentPage);
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
			renderPage(currentPage);
		}
	}

	function zoomIn() {
		scale = Math.min(scale + 0.25, 3);
		renderPage(currentPage);
	}

	function zoomOut() {
		scale = Math.max(scale - 0.25, 0.5);
		renderPage(currentPage);
	}

	$: if (file) {
		loadPdf(file);
	}

	// Re-render when highlight settings change
	$: highlightKey = `${highlightQuery}-${highlightCaseSensitive}-${highlightWholeWord}-${highlightContextLength}`;
	let prevHighlightKey = '';
	$: if (highlightKey !== prevHighlightKey && pdfDoc && !isLoading) {
		prevHighlightKey = highlightKey;
		renderPage(currentPage);
	}

	onDestroy(() => {
		if (pdfDoc) {
			pdfDoc.destroy();
		}
	});
</script>

{#if file}
	<div class={wrapperClasses}>
		<div class="flex items-center justify-between p-3 bg-base-300">
			<div class="flex items-center gap-2">
				<button
					class="btn btn-sm btn-ghost"
					on:click={prevPage}
					disabled={currentPage <= 1 || isLoading}
				>
					←
				</button>
				<span class="text-sm">
					{currentPage} / {totalPages}
				</span>
				<button
					class="btn btn-sm btn-ghost"
					on:click={nextPage}
					disabled={currentPage >= totalPages || isLoading}
				>
					→
				</button>
			</div>
			<div class="flex items-center gap-2">
				<button
					class="btn btn-sm btn-ghost"
					on:click={zoomOut}
					disabled={scale <= 0.5 || isLoading}
				>
					−
				</button>
				<span class="text-sm">{Math.round(scale * 100)}%</span>
				<button
					class="btn btn-sm btn-ghost"
					on:click={zoomIn}
					disabled={scale >= 3 || isLoading}
				>
					+
				</button>
			</div>
		</div>

		<div class="p-4 overflow-auto max-h-[600px]" bind:this={canvasContainer}>
			{#if isLoading}
				<div class="flex items-center justify-center p-8">
					<span class="loading loading-spinner loading-lg text-primary"></span>
				</div>
			{/if}
		</div>
	</div>
{/if}
