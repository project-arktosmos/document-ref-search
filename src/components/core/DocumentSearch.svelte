<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import type { SearchResult, SearchOptions } from '$types/search.type';

	export let text: string = '';
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		search: SearchOptions;
		clear: void;
	}>();

	let query = '';
	let caseSensitive = false;
	let wholeWord = false;
	let contextLength = 50;
	let results: SearchResult[] = [];

	function performSearch() {
		if (!query.trim() || !text) {
			results = [];
			dispatch('clear');
			return;
		}

		const searchResults: SearchResult[] = [];
		let searchQuery = query;

		if (wholeWord) {
			searchQuery = `\\b${escapeRegExp(query)}\\b`;
		} else {
			searchQuery = escapeRegExp(query);
		}

		const flags = caseSensitive ? 'g' : 'gi';
		const regex = new RegExp(searchQuery, flags);
		let match: RegExpExecArray | null;
		let index = 0;

		while ((match = regex.exec(text)) !== null) {
			const position = match.index;
			const matchText = match[0];
			const startContext = Math.max(0, position - contextLength);
			const endContext = Math.min(text.length, position + matchText.length + contextLength);

			const contextBefore = text.slice(startContext, position);
			const contextAfter = text.slice(position + matchText.length, endContext);

			searchResults.push({
				id: `result-${index}`,
				matchIndex: index,
				matchText,
				contextBefore: (startContext > 0 ? '...' : '') + contextBefore,
				contextAfter: contextAfter + (endContext < text.length ? '...' : ''),
				position
			});

			index++;

			if (index >= 500) break;
		}

		results = searchResults;

		dispatch('search', {
			query,
			caseSensitive,
			wholeWord,
			contextLength
		});
	}

	function escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		performSearch();
	}

	function handleClear() {
		query = '';
		results = [];
		dispatch('clear');
	}

	$: containerClasses = classNames('flex flex-col h-full', classes);
</script>

<div class={containerClasses}>
	<form on:submit={handleSubmit} class="space-y-4 mb-4">
		<div class="form-control">
			<label for="search-query" class="label">
				<span class="label-text font-medium">Search in Document</span>
			</label>
			<div class="join w-full">
				<input
					id="search-query"
					type="text"
					bind:value={query}
					placeholder="Enter search text..."
					class="input input-bordered join-item flex-1"
				/>
				<button type="submit" class="btn btn-primary join-item" disabled={!text || !query.trim()}>
					Search
				</button>
			</div>
		</div>

		<div class="flex flex-wrap gap-4">
			<label class="label cursor-pointer gap-2">
				<input type="checkbox" bind:checked={caseSensitive} class="checkbox checkbox-sm" />
				<span class="label-text">Case sensitive</span>
			</label>

			<label class="label cursor-pointer gap-2">
				<input type="checkbox" bind:checked={wholeWord} class="checkbox checkbox-sm" />
				<span class="label-text">Whole word</span>
			</label>

			<div class="form-control">
				<label class="label cursor-pointer gap-2">
					<span class="label-text">Context:</span>
					<select bind:value={contextLength} class="select select-bordered select-sm">
						<option value={25}>25 chars</option>
						<option value={50}>50 chars</option>
						<option value={100}>100 chars</option>
						<option value={200}>200 chars</option>
					</select>
				</label>
			</div>
		</div>

		{#if query}
			<button type="button" class="btn btn-ghost btn-sm" on:click={handleClear}>
				Clear Search
			</button>
		{/if}
	</form>

	{#if !text}
		<div class="alert alert-info">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="h-6 w-6 shrink-0 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span>Upload a document to search within its contents.</span>
		</div>
	{:else if results.length > 0}
		<div class="flex-1 overflow-hidden flex flex-col">
			<div class="text-sm text-base-content/70 mb-2">
				Found <span class="font-semibold">{results.length}</span> result{results.length !== 1
					? 's'
					: ''}
			</div>
			<div class="flex-1 overflow-y-auto space-y-3">
				{#each results as result (result.id)}
					<div class="card bg-base-200 shadow-sm">
						<div class="card-body p-4">
							<div class="text-xs text-base-content/50 mb-1">
								Match #{result.matchIndex + 1} at position {result.position}
							</div>
							<p class="text-sm font-mono break-all">
								<span class="text-base-content/70">{result.contextBefore}</span><mark
									class="bg-warning text-warning-content px-0.5 rounded font-semibold"
									>{result.matchText}</mark
								><span class="text-base-content/70">{result.contextAfter}</span>
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else if query.trim()}
		<div class="alert">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="h-6 w-6 shrink-0 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			<span>No results found for "{query}"</span>
		</div>
	{/if}
</div>
