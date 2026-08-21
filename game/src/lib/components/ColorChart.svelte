<script lang="ts">
	import { PieChart, BarChart } from 'layerchart';
	import { scaleLog } from 'd3-scale';
	import type { FlagColor } from '../types';
	import { hexToHsl } from '../similarity';

	let { colors }: { colors: FlagColor[] } = $props();

	let mode = $state<'pie' | 'bar'>('pie');
	let logY = $state(false);

	const MINOR_THRESHOLD = 1; // %

	function toPoint(c: FlagColor) {
		return { hex: c.hex, pct: Math.round(c.pct * 10) / 10 };
	}

	// Bar chart reads largest-to-smallest.
	let barData = $derived([...colors].sort((a, b) => b.pct - a.pct).map(toPoint));

	// Pie chart is sorted by hue (perceptual order around the colour wheel)
	// rather than prevalence, so adjacent wedges look related instead of
	// jumping between unrelated hues.
	let pieSorted = $derived(
		[...colors]
			.sort((a, b) => {
				const ha = hexToHsl(a.hex);
				const hb = hexToHsl(b.hex);
				return ha.h - hb.h || ha.l - hb.l;
			})
			.map(toPoint)
	);
	// Slivers under 1% are unreadable as wedges — pull them out into a swatch
	// grid below the pie instead of leaving them as invisible slices.
	let pieMajor = $derived(pieSorted.filter((d) => d.pct >= MINOR_THRESHOLD));
	let pieMinor = $derived(pieSorted.filter((d) => d.pct < MINOR_THRESHOLD));

	let data = $derived(mode === 'pie' ? pieMajor : barData);
	let hexDomain = $derived(data.map((d) => d.hex));

	// scaleLog is undefined at 0, so clamp the domain floor away from it.
	let barYScale = $derived(logY ? scaleLog().domain([0.1, 100]).clamp(true) : undefined);
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
			<!-- <div class="bar-options">
				<label>
					<input type="checkbox" bind:checked={logY} />
					Log y-axis
				</label>
			</div> -->
			<BarChart {data} x="hex" y="pct" c="hex" cDomain={hexDomain} cRange={hexDomain} yScale={barYScale} />
		{/if}
	</div>

	{#if mode === 'pie' && pieMinor.length > 0}
		<div class="minor-grid" aria-label="Colours under 1%">
			{#each pieMinor as d (d.hex)}
				<div class="minor-swatch" title="{d.hex} — {d.pct}%">
					<span class="swatch" style:background={d.hex}></span>
					<span class="swatch-label">{d.pct}%</span>
				</div>
			{/each}
		</div>
	{/if}
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
	.bar-options {
		display: flex;
		justify-content: flex-end;
		font-size: 0.8rem;
		opacity: 0.8;
	}
	.bar-options label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
	}
	.minor-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
		gap: 0.4rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface);
	}
	.minor-swatch {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.75rem;
	}
	.swatch {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 0.2rem;
		border: 1px solid var(--border);
		flex-shrink: 0;
	}
	.swatch-label {
		opacity: 0.75;
	}
</style>
