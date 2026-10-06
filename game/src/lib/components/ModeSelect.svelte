<script lang="ts">
	import type { GameMode, QuickplayRounds, TimedMinutes } from '../types';
	import { icon } from '../icons';

	let { onSelect }: { onSelect: (mode: GameMode, rounds?: QuickplayRounds, minutes?: TimedMinutes) => void } =
		$props();

	const ROUND_OPTIONS: QuickplayRounds[] = [5, 10]; //, 20, 'all'];
	const MINUTE_OPTIONS: TimedMinutes[] = [1, 3, 5];
</script>

<div class="mode-select">
	<section class="mode-card glass">
		<h2>{@html icon('rounds')}Quickplay</h2>
		<p>Play a fixed number of rounds back-to-back, then see your results.</p>
		<div class="options">
			{#each ROUND_OPTIONS as n (n)}
				<button type="button" class="btn btn-quiet" onclick={() => onSelect('quickplay', n)}>
					{n} rounds
				</button>
			{/each}
		</div>
	</section>

	<section class="mode-card glass">
		<h2>{@html icon('timer')}Timed</h2>
		<p>Answer as many rounds as you can before the clock runs out.</p>
		<div class="options">
			{#each MINUTE_OPTIONS as m (m)}
				<button type="button" class="btn btn-quiet" onclick={() => onSelect('timed', undefined, m)}>{m} min</button>
			{/each}
		</div>
	</section>

	<section class="mode-card glass">
		<h2>{@html icon('shuffle')}Freeplay</h2>
		<p>Unlimited rounds, one at a time, at your own pace.</p>
		<div class="options">
			<button type="button" class="btn btn-primary" onclick={() => onSelect('freeplay')}>Play</button>
		</div>
	</section>
</div>

<style>
	.mode-select {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.mode-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		border-radius: var(--radius-card);
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		line-height: 24px;
		color: var(--brand-ink);
	}
	h2 :global(svg) {
		width: 20px;
		height: 20px;
	}
	p {
		font-size: 14px;
		line-height: 20px;
		color: var(--muted);
	}
	.options {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
