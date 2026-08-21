<script lang="ts">
	import type { Country, FlagColor } from '../types';
	import { BUCKETS, classify, type Bucket } from '../similarity';

	let { countries, onSelect }: { countries: Country[]; onSelect: (c: Country) => void } = $props();

	let query = $state('');
	let sortBy = $state<'name' | 'colour'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let activeBuckets = $state<Set<Bucket>>(new Set());
	let activeContinents = $state<Set<string>>(new Set());
	let colourPickerOpen = $state(false);
	let continentPickerOpen = $state(false);

	// All continents present in the data, alphabetical.
	let allContinents = $derived([...new Set(countries.flatMap((c) => c.continents))].sort());

	function toggleBucket(b: Bucket) {
		const next = new Set(activeBuckets);
		if (next.has(b)) next.delete(b);
		else next.add(b);
		activeBuckets = next;
	}

	function toggleContinent(cont: string) {
		const next = new Set(activeContinents);
		if (next.has(cont)) next.delete(cont);
		else next.add(cont);
		activeContinents = next;
	}

	function toggleSortBy() {
		sortBy = sortBy === 'name' ? 'colour' : 'name';
	}

	function toggleDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	function closePickers() {
		colourPickerOpen = false;
		continentPickerOpen = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if ((colourPickerOpen || continentPickerOpen) && e.key === 'Escape') closePickers();
	}

	// Country's largest colour, for sorting and display grouping.
	function dominantColor(c: Country): FlagColor {
		return [...c.colors].sort((a, b) => b.pct - a.pct)[0] ?? { hex: '#000000', pct: 0 };
	}

	// A country's set of colour buckets, for intersection filtering.
	function bucketsOf(c: Country): Set<Bucket> {
		return new Set(c.colors.map((col) => classify(col.hex)));
	}

	let filtered = $derived(
		[...countries]
			.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
			.filter((c) => {
				if (activeBuckets.size === 0) return true;
				const has = bucketsOf(c);
				return [...activeBuckets].every((b) => has.has(b));
			})
			.filter((c) => activeContinents.size === 0 || c.continents.some((cont) => activeContinents.has(cont)))
			.sort((a, b) => {
				const dir = sortDir === 'asc' ? 1 : -1;
				if (sortBy === 'name') return dir * a.name.localeCompare(b.name);
				const da = dominantColor(a);
				const db = dominantColor(b);
				const hueDiff = BUCKETS.indexOf(classify(da.hex)) - BUCKETS.indexOf(classify(db.hex));
				return dir * (hueDiff || db.pct - da.pct || a.name.localeCompare(b.name));
			})
	);
</script>

<div class="all-list">
	<input
		type="text"
		class="search-bar"
		placeholder="Search countries..."
		bind:value={query}
		aria-label="Search countries"
	/>

	<div class="controls">
		<div class="sort-controls" role="group" aria-label="Sort by">
			<button type="button" class="sort-by" onclick={toggleSortBy}>
				Sort: {sortBy === 'name' ? 'Name' : 'Colour'}
			</button>
			<button type="button" class="dir" onclick={toggleDir} aria-label="Toggle sort direction">
				{sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
			</button>
		</div>

		<button type="button" class="filter-btn" onclick={() => (colourPickerOpen = true)}>
			Colours
			{#if activeBuckets.size > 0}
				<span class="filter-btn-swatches">
					{#each [...activeBuckets] as b (b)}
						<span class="bucket-swatch bucket-{b}"></span>
					{/each}
				</span>
			{/if}
		</button>

		<button type="button" class="filter-btn" onclick={() => (continentPickerOpen = true)}>
			Continents{activeContinents.size > 0 ? ` (${activeContinents.size})` : ''}
		</button>
	</div>

	{#if filtered.length > 0}
		<ol class="rows">
			{#each filtered as c (c.cca3)}
				<li>
					<button type="button" class="row" onclick={() => onSelect(c)}>
						<span class="name">{c.name}</span>
						<span class="colors">
							{#each [...c.colors].sort((a, b) => b.pct - a.pct) as col (col.hex)}
								<span
									class="color-seg"
									style="width: {col.pct}%; background: {col.hex}"
									title="{col.hex} {Math.round(col.pct)}%"
								></span>
							{/each}
						</span>
					</button>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="empty">No countries match "{query}".</p>
	{/if}
</div>

<svelte:window onkeydown={onKeydown} />

{#if colourPickerOpen}
	<div
		class="overlay"
		role="button"
		tabindex="-1"
		onclick={closePickers}
		onkeydown={(e) => e.key === 'Enter' && closePickers()}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Filter by colour"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="close" aria-label="Close" onclick={closePickers}>✕</button>
			<h2>Filter by colour</h2>
			<p class="hint">Flags must contain all selected colours.</p>
			<div class="option-filters" role="group" aria-label="Colours">
				{#each BUCKETS as b (b)}
					<button
						type="button"
						class="option"
						class:active={activeBuckets.has(b)}
						onclick={() => toggleBucket(b)}
						aria-pressed={activeBuckets.has(b)}
					>
						<span class="bucket-swatch bucket-{b}"></span>
						{b}
					</button>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="clear" onclick={() => (activeBuckets = new Set())}>Clear</button>
				<button type="button" class="done" onclick={closePickers}>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if continentPickerOpen}
	<div
		class="overlay"
		role="button"
		tabindex="-1"
		onclick={closePickers}
		onkeydown={(e) => e.key === 'Enter' && closePickers()}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="Filter by continent"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="close" aria-label="Close" onclick={closePickers}>✕</button>
			<h2>Filter by continent</h2>
			<p class="hint">Flags must be on any selected continent.</p>
			<div class="option-filters" role="group" aria-label="Continents">
				{#each allContinents as cont (cont)}
					<button
						type="button"
						class="option"
						class:active={activeContinents.has(cont)}
						onclick={() => toggleContinent(cont)}
						aria-pressed={activeContinents.has(cont)}
					>
						{cont}
					</button>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="clear" onclick={() => (activeContinents = new Set())}>Clear</button>
				<button type="button" class="done" onclick={closePickers}>Done</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.all-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}
	.search-bar {
		width: 100%;
		padding: 0.6rem 0.9rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: inherit;
		font-size: 1rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}
	.sort-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.sort-controls button,
	.filter-btn {
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.filter-btn-swatches {
		display: inline-flex;
		gap: 0.2rem;
	}
	.bucket-swatch {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 50%;
		border: 1px solid var(--border);
		display: inline-block;
	}
	.bucket-black {
		background: #1a1a1a;
	}
	.bucket-white {
		background: #f5f5f5;
	}
	.bucket-gray {
		background: #9a9a9a;
	}
	.bucket-red {
		background: #d32f2f;
	}
	.bucket-orange {
		background: #f57c00;
	}
	.bucket-yellow {
		background: #fbc02d;
	}
	.bucket-green {
		background: #388e3c;
	}
	.bucket-cyan {
		background: #00acc1;
	}
	.bucket-blue {
		background: #1976d2;
	}
	.bucket-purple {
		background: #7b1fa2;
	}
	.bucket-pink {
		background: #e91e8c;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}
	.row {
		display: grid;
		grid-template-columns: 9rem 1fr;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 0.4rem;
		background: transparent;
		color: inherit;
		font-size: 0.9rem;
		text-align: left;
		cursor: pointer;
	}
	.row:hover,
	.row:focus-visible {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.colors {
		display: flex;
		height: 0.6rem;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid var(--border);
	}
	.color-seg {
		height: 100%;
	}
	.empty {
		opacity: 0.7;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 100;
	}
	.modal {
		position: relative;
		width: 100%;
		max-width: 26rem;
		max-height: 90vh;
		overflow-y: auto;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1.5rem;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.modal h2 {
		margin: 0;
	}
	.modal .hint {
		margin: -0.5rem 0 0;
		opacity: 0.7;
		font-size: 0.85rem;
	}
	.close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
	.close:hover {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	.option-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.option-filters button {
		padding: 0.3rem 0.7rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--surface);
		color: inherit;
		font-size: 0.8rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
	.option-filters button.active {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	.modal-actions {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.modal-actions button {
		padding: 0.4rem 0.9rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}
	.modal-actions .done {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
</style>
