<script lang="ts">
	import type { RoundOutcome, SessionConfig } from '../types';
	import { buildShareUrl, solveDateText, summaryEmoji } from '../share';
	import { flagUrl } from '../types';
	import { icon } from '../icons';

	let {
		mode,
		config,
		results,
		seed,
		datasetHash,
		onNewSession
	}: {
		mode: 'quickplay' | 'timed';
		config: SessionConfig;
		results: RoundOutcome[];
		/** The seed that regenerates this session's sequence; carried by the share link. */
		seed: number;
		/** Fingerprint of the current dataset, embedded in share links. */
		datasetHash: string;
		onNewSession: () => void;
	} = $props();

	let copied = $state(false);
	let showFallback = $state(false);
	let emojiLine = $derived(summaryEmoji(results));
	let solveDate = $derived(solveDateText());
	// Every share link carries the run's seed (daily or pinned), so the
	// recipient plays the exact same flags regardless of date or timezone.
	let shareUrl = $derived(buildShareUrl(config, seed, datasetHash));
	let shareText = $derived(`Convexity ${mode === 'quickplay' ? 'Quickplay' : 'Timed'} — ${solveDate}\n${emojiLine}\n${shareUrl}`);

	let solvedCount = $derived(results.filter((r) => r.result !== 'unsolved').length);

	async function copyShare() {
		try {
			await navigator.clipboard.writeText(shareText);
			copied = true;
		} catch {
			// Clipboard API unavailable/denied — fall back to a manual-select text box.
			copied = false;
			showFallback = true;
		}
		setTimeout(() => (copied = false), 2000);
	}
</script>

<section class="results glass">
	<p class="score">{solvedCount} / {results.length} solved</p>

	<ol class="round-list">
		{#each results as r, i (i)}
			<li class:unsolved={r.result === 'unsolved'}>
				<img class="flag" src={flagUrl(r.target.cca2, 40)} alt={r.target.name} />
				<span class="name">{r.target.name}</span>
				<span class="outcome" class:hinted={r.result === 'solved-with-hints'}>
					{#if r.result === 'solved-no-hints'}{@html icon('check')}No hints
					{:else if r.result === 'solved-with-hints'}{@html icon('check')}{r.hintsRevealed} hint{r.hintsRevealed === 1 ? '' : 's'}
					{:else}{@html icon('cross')}Unsolved{/if}
				</span>
			</li>
		{/each}
	</ol>

	<div class="share">
		<div class="share-grid" role="img" aria-label="Round results">
			{#each results as r, i (i)}
				<i class:hinted={r.result === 'solved-with-hints'} class:unsolved={r.result === 'unsolved'}></i>
			{/each}
		</div>
		<div class="share-actions">
			<button type="button" class="btn btn-primary" onclick={copyShare}>{@html icon(copied ? 'check' : 'copy')}{copied ? 'Copied' : 'Copy results'}</button>
		</div>
		{#if showFallback}
			<textarea readonly value={shareText} onclick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
			></textarea>
		{/if}
	</div>

	<button type="button" class="btn btn-quiet" onclick={onNewSession}>{@html icon('shuffle')}Play again</button>
</section>

<style>
	.results {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 18px;
	}
	.score {
		font-size: 24px;
		line-height: 30px;
		font-weight: 700;
		color: var(--brand-ink);
	}
	.round-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		max-width: 26rem;
	}
	li {
		display: grid;
		grid-template-columns: 24px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 7px 10px;
		border-radius: var(--radius-control);
		background: var(--surface-strong);
		border: 1px solid var(--surface-border);
		font-size: 14px;
		line-height: 20px;
	}
	.flag {
		width: 24px;
		height: auto;
		border-radius: var(--radius-flag);
		box-shadow: 0 0 0 1px var(--chart-rim);
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.outcome {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
		color: var(--ok);
	}
	.outcome :global(svg) {
		width: 14px;
		height: 14px;
	}
	.outcome.hinted {
		color: var(--warn);
	}
	li.unsolved .outcome {
		color: var(--error);
	}
	.share {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: 100%;
		max-width: 26rem;
		padding: 18px;
		border-radius: var(--radius-card);
		background: var(--surface-strong);
		border: 1px solid var(--surface-border);
	}
	.share-grid {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px;
	}
	.share-grid i {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		background: var(--ok);
	}
	.share-grid i.hinted {
		background: var(--warn);
	}
	.share-grid i.unsolved {
		background: var(--error);
	}
	textarea {
		width: 100%;
		min-height: 4rem;
		font-size: 14px;
		color: var(--ink);
		background: var(--surface-strong);
		border: 1px solid var(--edge);
		border-radius: var(--radius-btn);
		padding: 8px 10px;
	}
</style>
