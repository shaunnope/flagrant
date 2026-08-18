<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from './lib/game.svelte';
	import ColorChart from './lib/components/ColorChart.svelte';
	import SearchInput from './lib/components/SearchInput.svelte';
	import GuessList from './lib/components/GuessList.svelte';
	import HintPanel from './lib/components/HintPanel.svelte';

	onMount(() => game.init());

	let alreadyGuessed = $derived(new Set(game.guesses.map((g) => g.country.cca3)));
</script>

<main>
	<header>
		<h1>Convexity</h1>
		<p class="tagline">Guess the flag from its colour distribution.</p>
	</header>

	{#if game.loading}
		<p>Loading flags…</p>
	{:else if game.error}
		<p class="error">Failed to load dataset: {game.error}</p>
	{:else if game.target}
		<section class="chart-section">
			<ColorChart colors={game.target.colors} />
		</section>

		<section class="hint-section">
			<HintPanel target={game.target} revealed={game.revealedHints} neighborName={(c) => game.neighborName(c)} />
			{#if game.hintsRevealed < 4 && !game.over}
				<p class="hint-progress">{4 - game.hintsRevealed} more wrong guess(es) until the next hint.</p>
			{/if}
		</section>

		{#if game.over}
			<section class="result">
				{#if game.won}
					<p class="win">🎉 It was {game.target.name}!</p>
				{:else}
					<p class="lose">The answer was {game.target.name}.</p>
				{/if}
				<button class="primary" onclick={() => game.newRound()}>Play again</button>
			</section>
		{:else}
			<section class="input-section">
				<SearchInput
					countries={game.countries}
					disabled={game.over}
					{alreadyGuessed}
					onSelect={(c) => game.guess(c)}
				/>
				{#if game.unlimitedGuesses}
					<button class="secondary" onclick={() => game.giveUp()}>Give up</button>
				{/if}
			</section>
		{/if}

		<section class="guesses-section">
			<GuessList guesses={game.guesses} />
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	header {
		text-align: center;
	}
	h1 {
		margin: 0 0 0.25rem;
		font-size: 2rem;
	}
	.tagline {
		margin: 0;
		opacity: 0.7;
	}
	.chart-section {
		display: flex;
		justify-content: center;
	}
	.hint-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: center;
	}
	.hint-progress {
		font-size: 0.8rem;
		opacity: 0.6;
		margin: 0;
	}
	.input-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: center;
	}
	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.win {
		font-size: 1.2rem;
		font-weight: 600;
	}
	.lose {
		font-size: 1.1rem;
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
	.error {
		color: #e74c3c;
	}
</style>
