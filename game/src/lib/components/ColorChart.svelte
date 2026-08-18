<script lang="ts">
	import { PieChart, BarChart } from 'layerchart';
	import type { FlagColor } from '../types';
	import { hexToHsl } from '../similarity';

	let { colors }: { colors: FlagColor[] } = $props();

	let mode = $state<'pie' | 'bar'>('pie');

	function toPoint(c: FlagColor) {
		return { hex: c.hex, pct: Math.round(c.pct * 10) / 10 };
	}

	// Bar chart reads largest-to-smallest.
	let barData = $derived([...colors].sort((a, b) => b.pct - a.pct).map(toPoint));
	// Pie chart is sorted by hue (perceptual order around the colour wheel)
	// rather than prevalence, so adjacent wedges look related instead of
	// jumping between unrelated hues.
	let pieData = $derived(
		[...colors]
			.sort((a, b) => {
				const ha = hexToHsl(a.hex);
				const hb = hexToHsl(b.hex);
				return ha.h - hb.h || ha.l - hb.l;
			})
			.map(toPoint)
	);
	let data = $derived(mode === 'pie' ? pieData : barData);
	let hexDomain = $derived(data.map((d) => d.hex));
</script>

<div class="color-chart">
	<div class="toggle" role="group" aria-label="Chart format">
		<button class:active={mode === 'pie'} onclick={() => (mode = 'pie')}>Pie</button>
		<button class:active={mode === 'bar'} onclick={() => (mode = 'bar')}>Bar</button>
	</div>

	<div class="chart-area">
		{#if mode === 'pie'}
			<PieChart
				{data}
				key="hex"
				value="pct"
				c="hex"
				cDomain={hexDomain}
				cRange={hexDomain}
				label="hex"
				props={{ pie: { sort: null } }}
			/>
		{:else}
			<BarChart {data} x="hex" y="pct" c="hex" cDomain={hexDomain} cRange={hexDomain} />
		{/if}
	</div>
</div>

<style>
	.color-chart {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}
	.toggle {
		display: flex;
		gap: 0.5rem;
		align-self: center;
	}
	.toggle button {
		padding: 0.3rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.toggle button.active {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
	.chart-area {
		width: 100%;
		height: 320px;
	}
</style>
