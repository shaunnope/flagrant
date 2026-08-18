<script lang="ts">
	import type { Country, HintKind } from '../types';

	let {
		target,
		revealed,
		neighborName
	}: { target: Country; revealed: HintKind[]; neighborName: (cca3: string) => string } = $props();

	function fmtPopulation(n: number | null): string {
		if (n == null) return 'unknown';
		return n.toLocaleString();
	}
	function fmtArea(km2: number | null): string {
		if (km2 == null) return 'unknown';
		return `${Math.round(km2).toLocaleString()} km²`;
	}
</script>

{#if revealed.length > 0}
	<div class="hints">
		{#each revealed as hint (hint)}
			<div class="hint">
				{#if hint === 'neighbors'}
					<strong>Neighbors:</strong>
					{target.borders.length > 0 ? target.borders.map(neighborName).join(', ') : 'none (island / isolated)'}
				{:else if hint === 'population'}
					<strong>Population:</strong>
					{fmtPopulation(target.population)}
				{:else if hint === 'size'}
					<strong>Size:</strong>
					{fmtArea(target.area_km2)}
				{:else if hint === 'continent'}
					<strong>Continent:</strong>
					{target.continents.join(', ') || target.region}
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.hints {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}
	.hint {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		font-size: 0.9rem;
	}
</style>
