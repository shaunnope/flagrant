<script lang="ts">
	import { icon } from '../icons';

	let {
		mode,
		roundIndex,
		total,
		remainingMs
	}: { mode: 'quickplay' | 'timed'; roundIndex: number; total: number; remainingMs: number | null } = $props();

	function fmtClock(ms: number): string {
		const totalSec = Math.ceil(ms / 1000);
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="progress glass">
	{#if mode === 'quickplay'}
		<span class="round"><b>Round {Math.min(roundIndex + 1, total)}</b> of {total}</span>
		<span class="pips" aria-hidden="true">
			{#each Array.from({ length: total }, (_, i) => i) as i (i)}
				<i class:done={i < roundIndex} class:now={i === roundIndex}></i>
			{/each}
		</span>
	{:else if remainingMs !== null}
		<span class="clock" class:low={remainingMs <= 10_000}>{@html icon('timer')}{fmtClock(remainingMs)}</span>
	{/if}
</div>

<style>
	.progress {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		font-size: 13.5px;
		line-height: 18px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.round b {
		font-weight: 600;
		color: var(--ink);
	}
	.pips {
		display: flex;
		gap: 4px;
		flex: 1;
	}
	.pips i {
		flex: 1;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--score-track);
		transition: background var(--duration-quick) ease;
	}
	.pips i.done {
		background: var(--ok);
	}
	.pips i.now {
		background: var(--brand-ink);
	}
	.clock {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		background: var(--surface-strong);
		font-size: 15px;
		color: var(--ink);
	}
	.clock :global(svg) {
		width: 16px;
		height: 16px;
	}
	.clock.low {
		color: var(--error);
		background: color-mix(in srgb, var(--error) 14%, transparent);
	}
</style>
