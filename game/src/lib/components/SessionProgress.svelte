<script lang="ts">
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

<div class="progress">
	{#if mode === 'quickplay'}
		<span>Round {Math.min(roundIndex + 1, total)} / {total}</span>
	{:else if remainingMs !== null}
		<span class="clock" class:low={remainingMs <= 10_000}>{fmtClock(remainingMs)}</span>
	{/if}
</div>

<style>
	.progress {
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}
	.clock {
		font-weight: 600;
	}
	.clock.low {
		color: #e74c3c;
	}
</style>
