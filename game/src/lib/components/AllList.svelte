<script lang="ts">
	import type { Country, FlagColor } from '../types';
	import { BUCKETS, classify, type Bucket } from '../similarity';
	import { icon } from '../icons';

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
	<div class="field-wrap">
		{@html icon('search')}
		<input
			type="text"
			class="field"
			placeholder="Search countries"
			bind:value={query}
			aria-label="Search countries"
		/>
	</div>

	<div class="controls">
		<div class="sort-controls" role="group" aria-label="Sort by">
			<button type="button" class="chip" onclick={toggleSortBy}>
				Sort: {sortBy === 'name' ? 'Name' : 'Colour'}
			</button>
			<button type="button" class="chip" onclick={toggleDir} aria-label="Toggle sort direction">
				{sortDir === 'asc' ? 'Ascending' : 'Descending'}
			</button>
		</div>

		<button type="button" class="chip" aria-pressed={false} onclick={() => (colourPickerOpen = true)}>
			Colours
			{#if activeBuckets.size > 0}
				<span class="filter-btn-swatches">
					{#each [...activeBuckets] as b (b)}
						<span class="hue hue-{b}"></span>
					{/each}
				</span>
			{/if}
		</button>

		<button type="button" class="chip" aria-pressed={false} onclick={() => (continentPickerOpen = true)}>
			Continents{activeContinents.size > 0 ? ` (${activeContinents.size})` : ''}
		</button>
	</div>

	{#if filtered.length > 0}
		<ol class="rows glass">
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
	<div class="modal-backdrop" role="presentation" onclick={closePickers}>
		<div
			class="modal glass"
			role="dialog"
			aria-modal="true"
			aria-label="Filter by colour"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="icon-btn small close" type="button" aria-label="Close" onclick={closePickers}>{@html icon('close')}</button>
			<h2>Filter by colour</h2>
			<p class="hint">Flags must contain all selected colours.</p>
			<div class="option-filters" role="group" aria-label="Colours">
				{#each BUCKETS as b (b)}
					<button
						type="button"
						class="chip"
												onclick={() => toggleBucket(b)}
						aria-pressed={activeBuckets.has(b)}
					>
						<span class="hue hue-{b}"></span>
						{b}
					</button>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="btn btn-quiet" onclick={() => (activeBuckets = new Set())}>Clear</button>
				<button type="button" class="btn btn-primary" onclick={closePickers}>Done</button>
			</div>
		</div>
	</div>
{/if}

{#if continentPickerOpen}
	<div class="modal-backdrop" role="presentation" onclick={closePickers}>
		<div
			class="modal glass"
			role="dialog"
			aria-modal="true"
			aria-label="Filter by continent"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<button class="icon-btn small close" type="button" aria-label="Close" onclick={closePickers}>{@html icon('close')}</button>
			<h2>Filter by continent</h2>
			<p class="hint">Flags must be on any selected continent.</p>
			<div class="option-filters" role="group" aria-label="Continents">
				{#each allContinents as cont (cont)}
					<button
						type="button"
						class="chip"
												onclick={() => toggleContinent(cont)}
						aria-pressed={activeContinents.has(cont)}
					>
						{cont}
					</button>
				{/each}
			</div>
			<div class="modal-actions">
				<button type="button" class="btn btn-quiet" onclick={() => (activeContinents = new Set())}>Clear</button>
				<button type="button" class="btn btn-primary" onclick={closePickers}>Done</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.all-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.sort-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.filter-btn-swatches {
		display: inline-flex;
		gap: 4px;
	}
	.rows {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 6px;
	}
	.row {
		display: grid;
		grid-template-columns: 9rem 1fr;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 7px 10px;
		border-radius: var(--radius-seg);
		font-size: 14px;
		line-height: 20px;
		font-weight: 400;
		text-align: left;
		transition: background var(--duration-quick) ease;
	}
	.row:hover,
	.row:focus-visible {
		background: var(--brand-fill);
		color: var(--on-brand);
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.colors {
		display: flex;
		height: 10px;
		border-radius: var(--radius-pill);
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--chart-rim);
	}
	.color-seg {
		height: 100%;
	}
	.color-seg + .color-seg {
		box-shadow: -1px 0 0 var(--chart-seam);
	}
	.empty {
		color: var(--muted);
	}
	.modal {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.modal h2 {
		font-size: 18px;
		line-height: 24px;
		color: var(--brand-ink);
		padding-right: 40px;
	}
	.modal .hint {
		margin-top: -6px;
		font-size: 14px;
		color: var(--muted-strong);
	}
	.close {
		position: absolute;
		top: 12px;
		right: 12px;
	}
	.option-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.modal-actions {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}
</style>
