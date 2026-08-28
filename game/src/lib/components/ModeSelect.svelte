<script lang="ts">
	import type { GameMode, QuickplayRounds, TimedMinutes } from '../types';

	let { onSelect }: { onSelect: (mode: GameMode, rounds?: QuickplayRounds, minutes?: TimedMinutes) => void } =
		$props();

	const ROUND_OPTIONS: QuickplayRounds[] = [5, 10]; //, 20, 'all'];
	const MINUTE_OPTIONS: TimedMinutes[] = [1, 3, 5];
</script>

<div class="mode-select">
	<section class="mode-card">
		<h2>Quickplay</h2>
		<p>Play a fixed number of rounds back-to-back, then see your results.</p>
		<div class="options">
			{#each ROUND_OPTIONS as n (n)}
				<button type="button" onclick={() => onSelect('quickplay', n)}>
					{n} rounds
				</button>
			{/each}
		</div>
	</section>

	<section class="mode-card">
		<h2>Timed</h2>
		<p>Answer as many rounds as you can before the clock runs out.</p>
		<div class="options">
			{#each MINUTE_OPTIONS as m (m)}
				<button type="button" onclick={() => onSelect('timed', undefined, m)}>{m} min</button>
			{/each}
		</div>
	</section>

	<section class="mode-card">
		<h2>Freeplay</h2>
		<p>Unlimited rounds, one at a time, at your own pace.</p>
		<div class="options">
			<button type="button" class="primary" onclick={() => onSelect('freeplay')}>Play</button>
		</div>
	</section>
</div>

<style>
	.mode-select {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.mode-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.6rem;
		border: 1px solid var(--border);
		background: var(--surface);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	p {
		margin: 0;
		opacity: 0.75;
		font-size: 0.9rem;
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 0.9rem;
	}
	button:hover {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	button.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
</style>
