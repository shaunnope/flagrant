<script lang="ts">
	import type { Guess } from '../types';

	let { guesses }: { guesses: Guess[] } = $props();

	function band(g: Guess): 'correct' | 'close' | 'warm' | 'cold' {
		if (g.correct) return 'correct';
		if (g.similarity >= 75) return 'close';
		if (g.similarity >= 40) return 'warm';
		return 'cold';
	}
	const WORD = { correct: 'Correct', close: 'Close', warm: 'Warm', cold: 'Cold' } as const;
</script>

{#if guesses.length > 0}
	<ol class="guess-list">
		{#each guesses as g (g.country.cca3 + g.similarity)}
			{@const b = band(g)}
			<li class:correct={g.correct} class:close={b === 'close' || b === 'correct'} class:warm={b === 'warm'}>
				<span class="name">{g.country.name}</span>
				<span class="colors">
					{#each [...g.country.colors].sort((a, b) => b.pct - a.pct) as c (c.hex)}
						<span class="color-seg" style="width: {c.pct}%; background: {c.hex}" title="{c.hex} {Math.round(c.pct)}%"
						></span>
					{/each}
				</span>
				<span class="bar-track">
					<span class="bar-fill" style="width: {g.similarity}%"></span>
				</span>
				<span class="pct">{Math.round(g.similarity)}%</span>
				<span class="band">{WORD[b]}</span>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.guess-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	li {
		display: grid;
		grid-template-columns: minmax(0, 8.5rem) 4.5rem 1fr 3.2rem 3.6rem;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		border-radius: var(--radius-control);
		background: var(--surface-strong);
		border: 1px solid var(--surface-border);
		font-size: 14px;
		line-height: 20px;
	}
	li:first-child {
		border-color: var(--edge);
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
	.bar-track {
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--score-track);
		overflow: hidden;
	}
	.bar-fill {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--score-cold);
		transition: width var(--duration-bar) var(--ease-out);
	}
	.close .bar-fill {
		background: var(--score-close);
	}
	.warm .bar-fill {
		background: var(--score-warm);
	}
	.pct {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.band {
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
		text-align: right;
		color: var(--muted-strong);
	}
	.close .band {
		color: var(--ok);
	}
	.warm .band {
		color: var(--warn);
	}
	li.correct {
		background: var(--brand-fill-strong);
		color: var(--on-brand);
	}
	li.correct .band {
		color: var(--on-brand);
	}
	li.correct .name {
		font-weight: 600;
	}
	@media (max-width: 480px) {
		li {
			grid-template-columns: minmax(0, 1fr) 3.2rem 3.6rem;
		}
		.colors,
		.bar-track {
			grid-column: 1 / -1;
			order: 5;
		}
	}
</style>
