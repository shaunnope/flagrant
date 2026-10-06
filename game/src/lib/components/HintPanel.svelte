<script lang="ts">
	import type { Country, HintKind } from '../types';
	import { icon } from '../icons';

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
				{@html icon(hint === 'neighbors' ? 'neighbours' : hint === 'size' ? 'area' : hint)}
				<span>
				{#if hint === 'neighbors'}
					<span class="k">Neighbours</span>
					{target.borders.length > 0 ? target.borders.map(neighborName).join(', ') : 'none (island / isolated)'}
				{:else if hint === 'population'}
					<span class="k">Population</span>
					{fmtPopulation(target.population)}
				{:else if hint === 'size'}
					<span class="k">Area</span>
					{fmtArea(target.area_km2)}
				{:else if hint === 'continent'}
					<span class="k">Continent</span>
					{target.continents.join(', ') || target.region}
				{/if}
				</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	.hints {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	.hint {
		display: grid;
		grid-template-columns: 22px 1fr;
		align-items: center;
		gap: 10px;
		padding: 9px 12px;
		border-radius: var(--radius-control);
		background: var(--surface-strong);
		border: 1px solid var(--surface-border);
		font-size: 15px;
		line-height: 21px;
		animation: hint-in var(--duration-open) var(--ease-out);
	}
	.hint :global(svg) {
		width: 18px;
		height: 18px;
		color: var(--brand-ink);
	}
	.k {
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
		color: var(--muted-strong);
		margin-right: 6px;
	}
	@keyframes hint-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
</style>
