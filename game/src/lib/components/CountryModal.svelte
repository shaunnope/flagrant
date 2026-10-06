<script lang="ts">
	import type { Country } from '../types';
	import { flagUrl } from '../types';
	import ColorChart from './ColorChart.svelte';
	import { icon } from '../icons';

	let { country, onClose }: { country: Country; onClose: () => void } = $props();

	function fmtPopulation(n: number | null): string {
		return n == null ? 'unknown' : n.toLocaleString();
	}
	function fmtArea(km2: number | null): string {
		return km2 == null ? 'unknown' : `${Math.round(km2).toLocaleString()} km²`;
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="modal-backdrop"
	role="presentation"
	onclick={onClose}
>
	<div
		class="modal glass"
		role="dialog"
		aria-modal="true"
		aria-label={country.name}
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<button class="icon-btn small close" type="button" aria-label="Close" onclick={onClose}>{@html icon('close')}</button>

		<div class="header">
			<img class="flag" src={flagUrl(country.cca2)} alt={country.name} />
			<div>
				<h2>{country.name}</h2>
				<p class="subregion">{country.subregion || country.region}</p>
			</div>
		</div>

		<dl class="details">
			<dt>Capital</dt>
			<dd>{country.capital.join(', ') || 'none'}</dd>
			<dt>Population</dt>
			<dd>{fmtPopulation(country.population)}</dd>
			<dt>Area</dt>
			<dd>{fmtArea(country.area_km2)}</dd>
			<dt>Continent</dt>
			<dd>{country.continents.join(', ') || country.region}</dd>
			<dt>Landlocked</dt>
			<dd>{country.landlocked == null ? 'unknown' : country.landlocked ? 'yes' : 'no'}</dd>
			<dt>Borders</dt>
			<dd>{country.borders.length > 0 ? country.borders.map((b) => b).join(', ') : 'none'}</dd>
		</dl>

		<ColorChart colors={country.colors} />
	</div>
</div>

<style>
	.modal {
		position: relative;
		max-width: 32rem;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.close {
		position: absolute;
		top: 12px;
		right: 12px;
	}
	.header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding-right: 40px;
	}
	.flag {
		width: 72px;
		height: auto;
		border-radius: var(--radius-flag);
		box-shadow: var(--shadow-flag), 0 0 0 1px var(--chart-rim);
		flex-shrink: 0;
	}
	h2 {
		font-size: 18px;
		line-height: 24px;
		color: var(--brand-ink);
	}
	.subregion {
		font-size: 14px;
		line-height: 20px;
		color: var(--muted-strong);
	}
	.details {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 12px;
		font-size: 14px;
		line-height: 20px;
	}
	dt {
		font-weight: 600;
		color: var(--muted-strong);
	}
	dd {
		margin: 0;
	}
</style>
