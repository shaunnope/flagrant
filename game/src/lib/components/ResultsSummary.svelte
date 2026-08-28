<script lang="ts">
	import type { Country, RoundOutcome, SessionConfig } from '../types';
	import { buildShareUrl, summaryEmoji } from '../share';
	import { flagUrl } from '../types';

	let {
		mode,
		config,
		targets,
		results,
		onNewSession
	}: {
		mode: 'quickplay' | 'timed';
		config: SessionConfig;
		targets: Country[];
		results: RoundOutcome[];
		onNewSession: () => void;
	} = $props();

	let copied = $state(false);
	let showFallback = $state(false);
	// Only the rounds actually played/resolved go into the share link — a
	// Timed session's `targets` can be longer than what was played, since
	// its internal queue is extended ahead of the clock running out.
	let shareTargets = $derived(targets.slice(0, results.length));
	let shareUrl = $derived(buildShareUrl(mode, config, shareTargets));
	let emojiLine = $derived(summaryEmoji(results));
	let shareText = $derived(`Convexity ${mode === 'quickplay' ? 'Quickplay' : 'Timed'}\n${emojiLine}\n${shareUrl}`);

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

<section class="results">
	<h2>Session complete</h2>
	<p class="score">{solvedCount} / {results.length} solved</p>

	<ol class="round-list">
		{#each results as r, i (i)}
			<li class:unsolved={r.result === 'unsolved'}>
				<img class="flag" src={flagUrl(r.target.cca2, 40)} alt={r.target.name} />
				<span class="name">{r.target.name}</span>
				<span class="outcome">
					{#if r.result === 'solved-no-hints'}🟩 no hints
					{:else if r.result === 'solved-with-hints'}🟨 {r.hintsRevealed} hint{r.hintsRevealed === 1 ? '' : 's'}
					{:else}🟥 unsolved{/if}
				</span>
			</li>
		{/each}
	</ol>

	<div class="share">
		<p class="emoji-line">{emojiLine}</p>
		<div class="share-actions">
			<button type="button" class="primary" onclick={copyShare}>{copied ? 'Copied!' : 'Copy results'}</button>
		</div>
		{#if showFallback}
			<textarea readonly value={shareText} onclick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
			></textarea>
		{/if}
	</div>

	<button type="button" class="secondary" onclick={onNewSession}>Play again</button>
</section>

<style>
	.results {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
	}
	h2 {
		margin: 0;
	}
	.score {
		margin: 0;
		opacity: 0.8;
	}
	.round-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
		max-width: 26rem;
	}
	li {
		display: grid;
		grid-template-columns: 1.6rem 1fr auto;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}
	.flag {
		width: 1.6rem;
		height: auto;
		border-radius: 0.15rem;
		border: 1px solid var(--border);
	}
	.name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.outcome {
		font-size: 0.85rem;
		opacity: 0.85;
	}
	li.unsolved .name {
		opacity: 0.7;
	}
	.share {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		max-width: 26rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.emoji-line {
		margin: 0;
		font-size: 1.2rem;
		letter-spacing: 0.1rem;
		word-break: break-all;
	}
	textarea {
		width: 100%;
		min-height: 4rem;
		font-family: inherit;
		font-size: 0.8rem;
		color: inherit;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		padding: 0.5rem;
	}
	button.primary,
	button.secondary {
		padding: 0.6rem 1.4rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		cursor: pointer;
		font-size: 0.95rem;
	}
	button.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
	button.secondary {
		background: transparent;
		color: inherit;
	}
</style>
