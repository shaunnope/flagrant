<script lang="ts">
	import type { Guess } from '../types';

	let { guesses }: { guesses: Guess[] } = $props();
</script>

{#if guesses.length > 0}
	<ol class="guess-list">
		{#each guesses as g (g.country.cca3 + g.similarity)}
			<li class:correct={g.correct}>
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
			</li>
		{/each}
	</ol>
{/if}

<style>
	.guess-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}
	li {
		display: grid;
		grid-template-columns: 9rem 5rem 1fr 3rem;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
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
	.bar-track {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--border);
		overflow: hidden;
	}
	.bar-fill {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.3s ease;
	}
	.pct {
		text-align: right;
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}
	li.correct .bar-fill {
		background: var(--success, #2ecc71);
	}
	li.correct .name {
		font-weight: 600;
	}
</style>
