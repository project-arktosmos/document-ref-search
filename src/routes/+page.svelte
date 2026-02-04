<script lang="ts">
	import { DocumentSearch, FileUpload, PdfViewer } from '$components/core';
	import { extractTextFromFile } from '$utils/file/extractText';
	import { FileType, getFileTypeFromMime } from '$types/file.type';
	import type { SearchOptions } from '$types/search.type';

	let extractedText = '';
	let fileName = '';
	let fileType: FileType | null = null;
	let currentFile: File | null = null;
	let isLoading = false;
	let error = '';

	let searchQuery = '';
	let searchCaseSensitive = false;
	let searchWholeWord = false;
	let searchContextLength = 50;

	async function handleFiles(event: CustomEvent<File[]>) {
		const files = event.detail;
		if (files.length === 0) return;

		const file = files[0];
		fileName = file.name;
		fileType = getFileTypeFromMime(file.type, file.name);
		currentFile = file;
		isLoading = true;
		error = '';

		try {
			extractedText = await extractTextFromFile(file);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to extract text from file';
			extractedText = '';
		} finally {
			isLoading = false;
		}
	}

	function handleClear() {
		extractedText = '';
		fileName = '';
		fileType = null;
		currentFile = null;
		error = '';
		searchQuery = '';
		searchCaseSensitive = false;
		searchWholeWord = false;
		searchContextLength = 50;
	}

	function handleSearch(event: CustomEvent<SearchOptions>) {
		const { query, caseSensitive, wholeWord, contextLength } = event.detail;
		searchQuery = query;
		searchCaseSensitive = caseSensitive;
		searchWholeWord = wholeWord;
		searchContextLength = contextLength;
	}

	function handleSearchClear() {
		searchQuery = '';
		searchCaseSensitive = false;
		searchWholeWord = false;
		searchContextLength = 50;
	}

	$: isPdf = fileType === FileType.PDF;
</script>

<div class="container mx-auto p-6">
	<h1 class="text-3xl font-bold mb-6">Document Text Extractor</h1>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2 space-y-6">
			<FileUpload on:files={handleFiles} loading={isLoading} />

			{#if error}
				<div class="alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}

			{#if currentFile && !isLoading}
				<div class="flex items-center justify-between">
					<span class="font-medium">{fileName}</span>
					<button class="btn btn-ghost btn-sm" on:click={handleClear}>
						Clear
					</button>
				</div>

				{#if isPdf}
					<PdfViewer
						file={currentFile}
						highlightQuery={searchQuery}
						highlightCaseSensitive={searchCaseSensitive}
						highlightWholeWord={searchWholeWord}
						highlightContextLength={searchContextLength}
					/>
				{/if}

				{#if extractedText}
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium">Extracted Text</summary>
						<div class="collapse-content">
							<textarea
								id="extracted-text"
								class="textarea textarea-bordered w-full h-96 font-mono text-sm"
								readonly
								value={extractedText}
							></textarea>
						</div>
					</details>
				{/if}
			{/if}
		</div>

		<div class="lg:border-l lg:pl-6 lg:border-base-300">
			<DocumentSearch text={extractedText} on:search={handleSearch} on:clear={handleSearchClear} />
		</div>
	</div>
</div>
