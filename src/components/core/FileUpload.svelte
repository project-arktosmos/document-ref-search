<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ACCEPTED_EXTENSIONS } from '$types/file.type';

	export let accept: string = ACCEPTED_EXTENSIONS.join(',');
	export let multiple: boolean = false;
	export let disabled: boolean = false;
	export let loading: boolean = false;
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		files: File[];
	}>();

	let fileInput: HTMLInputElement;
	let isDragging = false;

	$: wrapperClasses = classNames(
		'border-2 border-dashed rounded-lg p-8',
		'flex flex-col items-center justify-center gap-4',
		'transition-colors duration-200',
		'cursor-pointer',
		{
			'border-primary bg-primary/10': isDragging,
			'border-base-300 hover:border-primary': !isDragging && !disabled,
			'border-base-200 bg-base-200 cursor-not-allowed': disabled
		},
		classes
	);

	function handleClick() {
		if (!disabled && !loading) {
			fileInput.click();
		}
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			dispatch('files', Array.from(target.files));
			target.value = '';
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (!disabled && !loading) {
			isDragging = true;
		}
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (disabled || loading) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			const validFiles = Array.from(files).filter((file) => {
				const ext = '.' + file.name.split('.').pop()?.toLowerCase();
				return ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number]);
			});

			if (validFiles.length > 0) {
				dispatch('files', validFiles);
			}
		}
	}
</script>

<div
	class={wrapperClasses}
	on:click={handleClick}
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
	on:keydown={(e) => e.key === 'Enter' && handleClick()}
	role="button"
	tabindex="0"
>
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		{disabled}
		on:change={handleFileChange}
		class="hidden"
	/>

	{#if loading}
		<span class="loading loading-spinner loading-lg text-primary"></span>
		<p class="text-base-content/70">Processing file...</p>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="h-12 w-12 text-base-content/50"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
			/>
		</svg>
		<div class="text-center">
			<p class="text-base-content font-medium">
				Drop files here or click to upload
			</p>
			<p class="text-base-content/50 text-sm mt-1">
				Supports PDF, TXT, and MD files
			</p>
		</div>
	{/if}
</div>
