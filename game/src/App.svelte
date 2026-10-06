<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from './lib/game.svelte';
	import { session } from './lib/session.svelte';
	import { route } from './lib/route.svelte';
	import { flagUrl } from './lib/types';
	import type { Country, GameMode, QuickplayRounds, RoundOutcome, TimedMinutes } from './lib/types';
	import { decodeShareUrl } from './lib/share';
	import { readDailyAttempt, writeDailyAttempt } from './lib/dailyAttempt';
	import { dailySeed, datasetHash, randomSeed, reconstructDailySequence, todayLocalISODate } from './lib/seed';
	import { icon } from './lib/icons';
	import { theme } from './lib/theme.svelte';
	import ColorChart from './lib/components/ColorChart.svelte';
	import SearchInput from './lib/components/SearchInput.svelte';
	import GuessList from './lib/components/GuessList.svelte';
	import HintPanel from './lib/components/HintPanel.svelte';
	import AllList from './lib/components/AllList.svelte';
	import CountryModal from './lib/components/CountryModal.svelte';
	import HelpPage from './lib/components/HelpPage.svelte';
	import AboutPage from './lib/components/AboutPage.svelte';
	import ModeSelect from './lib/components/ModeSelect.svelte';
	import SessionProgress from './lib/components/SessionProgress.svelte';
	import ResultsSummary from './lib/components/ResultsSummary.svelte';
	import ThemeModal from './lib/components/ThemeModal.svelte';

	onMount(() => game.init());

	let themeOpen = $state(false);

	/** null = mode-selection screen is showing; no round/session active yet. */
	let activeMode = $state<GameMode | null>(null);
	let urlHandled = false;
	/** Guards against writing the same daily attempt record more than once per session. */
	let dailyRecordWritten = false;

	// Once the dataset finishes loading, resolve the initial screen from the
	// URL: a `?country=` link resumes Freeplay directly, a `?g=` share code
	// opens the run it encodes, otherwise land on mode-select.
	$effect(() => {
		if (urlHandled || game.loading || game.error) return;
		urlHandled = true;

		const params = new URLSearchParams(window.location.search);
		const countryCode = params.get('country');

		const share = decodeShareUrl(params);
		// A dataset-hash mismatch means the seed would yield different flags, so
		// fail into mode-select rather than silently play the wrong ones.
		if (share && share.datasetHash === datasetHash(game.countries)) {
			const { config, seed } = share;
			const selector = config.mode === 'quickplay' ? config.rounds : config.minutes;
			if (seed === dailySeed(todayLocalISODate(), config.mode, selector)) {
				// It's today's daily run: treat it as such (weak gate + daily record).
				enterMode(config.mode, config.mode === 'quickplay' ? config.rounds : undefined, config.mode === 'timed' ? config.minutes : undefined);
			} else {
				dailyRecordWritten = false;
				if (config.mode === 'quickplay') session.startQuickplay(game.countries, config.rounds, seed);
				else session.startTimed(game.countries, config.minutes, seed);
				activeMode = config.mode;
			}
			return;
		}

		if (countryCode && game.setRoundByCode(countryCode)) {
			activeMode = 'freeplay';
			return;
		}
		// No/invalid params: land on mode-select (activeMode stays null).
	});

	// Quickplay/Timed: once the active round resolves, briefly show the
	// reveal, then auto-advance to the next round (or end the session).
	$effect(() => {
		if ((activeMode === 'quickplay' || activeMode === 'timed') && game.over && !session.over) {
			const t = setTimeout(() => session.resolveRound(), 1200);
			return () => clearTimeout(t);
		}
	});

	// The first time a fresh, daily-seeded (non-pinned) session finishes,
	// persist its outcome as today's Daily Attempt Record for that
	// mode+configuration (FR-011) — powers the weak gate on revisit.
	// 'pinned' (Play again / opened-link) runs never write this record, so
	// the *first* attempt's record survives even if the player replays.
	$effect(() => {
		if (
			(activeMode === 'quickplay' || activeMode === 'timed') &&
			session.over &&
			session.origin === 'daily' &&
			session.config &&
			!dailyRecordWritten
		) {
			dailyRecordWritten = true;
			const selector = session.config.mode === 'quickplay' ? session.config.rounds : session.config.minutes;
			writeDailyAttempt(session.config.mode, selector, session.results);
		}
	});

	function handleModeSelect(mode: GameMode, rounds?: QuickplayRounds, minutes?: TimedMinutes) {
		if (mode === 'freeplay') {
			dailyRecordWritten = false;
			activeMode = 'freeplay';
			game.newRound();
			return;
		}
		if (mode === 'quickplay' && rounds !== undefined) {
			enterMode('quickplay', rounds, undefined);
		} else if (mode === 'timed' && minutes !== undefined) {
			enterMode('timed', undefined, minutes);
		}
	}

	/**
	 * Enters Quickplay/Timed for a given configuration — via mode-select or a
	 * today's share link (weak gate applies either way): shows today's
	 * already-attempted result if one exists, otherwise starts a fresh,
	 * daily-seeded session.
	 */
	function enterMode(mode: 'quickplay' | 'timed', rounds: QuickplayRounds | undefined, minutes: TimedMinutes | undefined) {
		dailyRecordWritten = false;
		if (mode === 'quickplay' && rounds !== undefined) {
			if (startFromDailyAttemptIfPresent('quickplay', rounds)) {
				activeMode = 'quickplay';
				return;
			}
			session.startQuickplay(game.countries, rounds);
			activeMode = 'quickplay';
		} else if (mode === 'timed' && minutes !== undefined) {
			if (startFromDailyAttemptIfPresent('timed', minutes)) {
				activeMode = 'timed';
				return;
			}
			session.startTimed(game.countries, minutes);
			activeMode = 'timed';
		}
	}

	/**
	 * Weak gate (FR-012): if today's mode+configuration was already
	 * attempted, rehydrate the session from that first attempt's record
	 * instead of starting a new one. Returns true when it did so.
	 */
	function startFromDailyAttemptIfPresent(mode: 'quickplay' | 'timed', configSelector: QuickplayRounds | TimedMinutes): boolean {
		const record = readDailyAttempt(mode, configSelector);
		if (!record) return false;

		const targets = reconstructDailySequence(todayLocalISODate(), mode, configSelector, game.countries, record.results.length).slice(
			0,
			record.results.length
		);
		const outcomes: RoundOutcome[] = record.results.map((r, i) => ({
			target: targets[i],
			result: r.result,
			hintsRevealed: r.hintsRevealed
		}));
		const config = mode === 'quickplay' ? { mode: 'quickplay' as const, rounds: configSelector as QuickplayRounds } : { mode: 'timed' as const, minutes: configSelector as TimedMinutes };
		session.hydrateFromRecord(config, targets, outcomes);
		dailyRecordWritten = true; // already recorded — don't re-write on this revisit
		return true;
	}

	/**
	 * "Play again" (FR-013): starts a fresh session from a new random seed
	 * (not day-seeded, not a replay of the prior targets) as a 'pinned'-origin
	 * session, rather than resetting to mode-select. Passing an explicit
	 * `seed` is what makes `session.origin` resolve to 'pinned' (see
	 * session.svelte.ts) — this one-off run is reproduced by sharing its
	 * `?g=` share link, since it isn't derivable from today's seed.
	 */
	function playAgain() {
		if (!session.config) return;
		const seed = randomSeed();
		dailyRecordWritten = false;
		if (session.config.mode === 'quickplay') {
			session.startQuickplay(game.countries, session.config.rounds, seed);
		} else {
			session.startTimed(game.countries, session.config.minutes, seed);
		}
	}

	function backToModeSelect() {
		session.reset();
		activeMode = null;
		dailyRecordWritten = false;
		window.history.replaceState(null, '', window.location.pathname + window.location.hash);
	}

	let alreadyGuessed = $derived(new Set(game.guesses.map((g) => g.country.cca3)));
	let selected = $state<Country | null>(null);
</script>

<main class="page">
	<header class="topbar glass">
		<div class="brand">
			<img class="logo" src="{import.meta.env.BASE_URL}favicon.svg" alt="" width="30" height="30" />
			<div>
				<h1>Convexity</h1>
				<p class="tagline">Guess the flag from its colour distribution.</p>
			</div>
		</div>
		<div class="topbar-actions">
			<nav class="nav" aria-label="Pages">
				{#if route.current === 'game'}
					{#if activeMode !== null}
						<button type="button" class="back" aria-label="Back to modes" onclick={backToModeSelect}>{@html icon('back')}</button>
					{:else}
						<a href="#/all">All flags</a>
					{/if}
					<a href="#/help">Help</a>
					<a href="#/about">About</a>
				{:else}
					<button type="button" class="back" onclick={() => route.go('game')}>{@html icon('back')}Game</button>
					{#if route.current !== 'all' && route.current !== 'help'}<a href="#/all">All flags</a>{/if}
					{#if route.current !== 'help'}<a href="#/help">Help</a>{/if}
					{#if route.current !== 'about'}<a href="#/about">About</a>{/if}
				{/if}
			</nav>
			<button class="icon-btn" type="button" title="Theme" aria-label="Theme" onclick={() => (themeOpen = true)}>
				{@html icon(theme.preference === 'system' ? 'system' : theme.preference === 'dark' ? 'moon' : 'sun')}
			</button>
		</div>
	</header>

	{#if route.current === 'help'}
		<HelpPage />
	{:else if route.current === 'about'}
		<AboutPage />
	{:else if game.loading}
		<p class="banner busy"><span class="dot"></span>Loading flags…</p>
	{:else if game.error}
		<p class="banner error">{@html icon('cross')}Could not load the flag list. Check your connection and reload.</p>
	{:else if route.current === 'all'}
		<AllList countries={game.countries} onSelect={(c) => (selected = c)} />
		{#if selected}
			<CountryModal country={selected} onClose={() => (selected = null)} />
		{/if}
	{:else if activeMode === null}
		<ModeSelect onSelect={handleModeSelect} />
	{:else if (activeMode === 'quickplay' || activeMode === 'timed') && session.over}
		<ResultsSummary
			mode={activeMode}
			config={session.config!}
			results={session.results}
			seed={session.seed!}
			datasetHash={datasetHash(game.countries)}
			onNewSession={playAgain}
		/>
	{:else if game.target}
		{#if activeMode === 'quickplay' || activeMode === 'timed'}
			<SessionProgress
				mode={activeMode}
				roundIndex={session.roundIndex}
				total={session.targets.length}
				remainingMs={session.remainingMs}
			/>
		{/if}

		<section class="chart-section glass">
			<ColorChart colors={game.target.colors} />
			{#if game.flashCountry && !game.over}
				<img class="flash-flag" src={flagUrl(game.flashCountry.cca2)} alt={game.flashCountry.name} />
			{/if}
		</section>

		<section class="hint-section">
			<HintPanel target={game.target} revealed={game.revealedHints} neighborName={(c) => game.neighborName(c)} />
		</section>

		{#if game.over}
			<section class="result glass">
				<img class="reveal-flag" src={flagUrl(game.target.cca2)} alt={game.target.name} />
				{#if game.won}
					<p class="win">{@html icon('check')}It was {game.target.name}.</p>
				{:else}
					<p class="lose">The answer was {game.target.name}.</p>
				{/if}
				{#if activeMode === 'freeplay'}
					<button class="btn btn-primary" onclick={() => game.newRound()}>{@html icon('shuffle')}Play again</button>
				{/if}
			</section>
		{:else}
			<section class="input-section glass">
				<SearchInput
					countries={game.countries}
					disabled={game.over}
					{alreadyGuessed}
					onSelect={(c) => game.guess(c)}
				/>
				<div class="input-actions">
					<button class="btn btn-giveup" onclick={() => game.giveUp()}>Give up</button>
				</div>
			</section>
		{/if}

		<section class="guesses-section">
			<GuessList guesses={game.guesses} />
		</section>
	{/if}
	<ThemeModal open={themeOpen} onClose={() => (themeOpen = false)} />
</main>

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px 10px 16px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	/* Narrowing screens shed the tagline first, then the title; the logo always stays. */
	@media (max-width: 680px) {
		.tagline {
			display: none;
		}
	}
	@media (max-width: 500px) {
		h1 {
			display: none;
		}
	}
	.logo {
		flex-shrink: 0;
	}
	h1 {
		font-size: 22px;
		line-height: 26px;
	}
	.tagline {
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
		color: var(--muted);
	}
	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.nav a,
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px;
		border-radius: var(--radius-pill);
		font-size: 13.5px;
		line-height: 18px;
		font-weight: 600;
		color: var(--brand-ink);
		text-decoration: none;
		white-space: nowrap;
		transition: background var(--duration-quick) ease;
	}
	.back :global(svg) {
		width: 16px;
		height: 16px;
	}
	.nav a:hover,
	.back:hover {
		background: var(--surface-strong);
	}
	.chart-section,
	.input-section,
	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 18px;
	}
	.input-section {
		gap: 8px;
	}
	.flash-flag,
	.reveal-flag {
		height: auto;
		border-radius: var(--radius-flag);
		box-shadow: var(--shadow-flag), 0 0 0 1px var(--chart-rim);
		animation: reveal var(--duration-open) var(--ease-out);
	}
	.flash-flag {
		width: 128px;
	}
	.reveal-flag {
		width: 160px;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.97);
		}
	}
	.hint-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		align-items: center;
	}
	.result {
		text-align: center;
	}
	.win,
	.lose {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 24px;
		line-height: 30px;
		font-weight: 700;
		color: var(--brand-ink);
	}
	.win :global(svg) {
		width: 22px;
		height: 22px;
		color: var(--ok);
	}
</style>
