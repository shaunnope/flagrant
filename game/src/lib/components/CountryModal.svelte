<script lang="ts">
	import type { Country } from '../types';
	import { flagUrl } from '../types';
	import ColorChart from './ColorChart.svelte';

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
	class="overlay"
	role="button"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Enter' && onClose()}
>
	<div
		class="modal"
		role="dialog"
		aria-modal="true"
		aria-label={country.name}
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<button class="close" aria-label="Close" onclick={onClose}>✕</button>

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
		max-width: 32rem;
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
	.header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.flag {
		width: 4.5rem;
		height: auto;
		border-radius: 0.35rem;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	h2 {
		margin: 0;
	}
	.subregion {
		margin: 0.15rem 0 0;
		opacity: 0.7;
		font-size: 0.9rem;
	}
	.details {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.3rem 0.75rem;
		margin: 0;
		font-size: 0.9rem;
	}
	dt {
		font-weight: 600;
		opacity: 0.8;
	}
	dd {
		margin: 0;
	}
</style>
