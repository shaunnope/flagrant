<script lang="ts">
	import { PieChart, BarChart } from 'layerchart';
	import { scaleLog } from 'd3-scale';
	import type { FlagColor } from '../types';
	import { hexToHsl } from '../similarity';
	import { icon } from '../icons';

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
		<button class:active={mode === 'pie'} aria-pressed={mode === 'pie'} onclick={() => (mode = 'pie')}>{@html icon('pie')}Pie</button>
		<button class:active={mode === 'bar'} aria-pressed={mode === 'bar'} onclick={() => (mode = 'bar')}>{@html icon('bar')}Bar</button>
	</div>

	<div class="chart-area">
		{#if mode === 'pie'}
			<!-- Ring drawn separately from the wedges: an Arc stroke would also
			     outline every sector divider, which we don't want — only the
			     pie's circumference should get a border. Sized/centred to match
			     PieChart's own default fit (a square of side min(width,height),
			     centred in the container). -->
			<div class="pie-ring-wrap">
				<div class="pie-ring"></div>
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
			</div>
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
				<div class="minor-swatch" title="{d.hex}, {d.pct}%">
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
		gap: 12px;
		width: 100%;
	}
	.toggle {
		display: inline-grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 6px;
		padding: 4px;
		align-self: center;
		border-radius: var(--radius-control);
		background: var(--surface);
		border: 1px solid var(--surface-border);
	}
	.toggle button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: var(--radius-seg);
		font-size: 13.5px;
		line-height: 18px;
		color: var(--muted-strong);
		transition: background var(--duration-quick) ease, color var(--duration-quick) ease;
	}
	.toggle button :global(svg) {
		width: 16px;
		height: 16px;
	}
	.toggle button.active {
		background: var(--brand-fill);
		color: var(--on-brand);
	}
	.chart-area {
		width: 100%;
		height: 320px;
	}
	@media (max-width: 480px) {
		.chart-area {
			height: 260px;
		}
	}
	.pie-ring-wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}
	/* Seam between wedges, and the rim round the pie, so a white or black
	   flag colour keeps its shape on the page. */
	.pie-ring-wrap :global(path) {
		stroke: var(--chart-seam);
		stroke-width: 2px;
		stroke-linejoin: round;
	}
	.pie-ring {
		position: absolute;
		inset: 0;
		margin: auto;
		height: 100%;
		width: auto;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 1.5px solid var(--chart-rim);
		pointer-events: none;
	}
	.chart-area :global(.lc-bar),
	.chart-area :global(rect) {
		stroke: var(--chart-seam);
		stroke-width: 2px;
	}
	.minor-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
	}
	.minor-swatch {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 5px;
		border-radius: var(--radius-pill);
		background: var(--surface-strong);
		border: 1px solid var(--surface-border);
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
		color: var(--muted-strong);
		font-variant-numeric: tabular-nums;
	}
	.swatch {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px var(--chart-rim);
		flex-shrink: 0;
	}
</style>
