<script lang="ts">
	import type { Country } from '../types';

	let { countries, onSelect }: { countries: Country[]; onSelect: (c: Country) => void } = $props();

	let query = $state('');

	let filtered = $derived(
		[...countries]
			.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
			.sort((a, b) => a.name.localeCompare(b.name))
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
</style>
