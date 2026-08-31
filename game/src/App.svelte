<script lang="ts">
	import { onMount } from 'svelte';
	import { game } from './lib/game.svelte';
	import { session } from './lib/session.svelte';
	import { route } from './lib/route.svelte';
	import { flagUrl } from './lib/types';
	import type { Country, GameMode, QuickplayRounds, RoundOutcome, TimedMinutes } from './lib/types';
	import { decodeModeUrl, decodeSession } from './lib/share';
	import { readDailyAttempt, writeDailyAttempt } from './lib/dailyAttempt';
	import { randomShuffleCountries, reconstructDailySequence, todayLocalISODate } from './lib/seed';
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

	onMount(() => game.init());

	/** null = mode-selection screen is showing; no round/session active yet. */
	let activeMode = $state<GameMode | null>(null);
	let urlHandled = false;
	/** Guards against writing the same daily attempt record more than once per session. */
	let dailyRecordWritten = false;

	// Once the dataset finishes loading, resolve the initial screen from the
	// URL: a `?country=` link resumes Freeplay directly, a `?s=` link opens
	// the shared session it encodes, otherwise land on mode-select.
	$effect(() => {
		if (urlHandled || game.loading || game.error) return;
		urlHandled = true;

		const params = new URLSearchParams(window.location.search);
		const countryCode = params.get('country');
		const shareParam = params.get('s');

		if (shareParam) {
			const decoded = decodeSession(shareParam, game.countries);
			if (decoded) {
				if (decoded.config.mode === 'quickplay') {
					session.startQuickplay(game.countries, decoded.config.rounds, decoded.targets);
				} else {
					session.startTimed(game.countries, decoded.config.minutes, decoded.targets);
				}
				activeMode = decoded.config.mode;
				return;
			}
			// Malformed/unsupported share link — fail gracefully into mode-select (FR-014).
		}

		// Plain `?mode=`/`?rounds=`/`?minutes=` link (a 'daily'-origin share):
		// no session data, just redirect straight into that mode — today's
		// seed (or the weak gate, if already attempted today) takes it from there.
		const modeLink = decodeModeUrl(params);
		if (modeLink) {
			enterMode(modeLink.mode, modeLink.rounds, modeLink.minutes);
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
	 * plain `?mode=` link (weak gate applies either way): shows today's
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
	 * "Play again" (FR-013): starts a fresh, truly randomized (not
	 * day-seeded, not a replay of the prior targets) session as a new
	 * 'pinned'-origin session, rather than resetting to mode-select. Passing
	 * an explicit `order` is what makes `session.origin` resolve to
	 * 'pinned' (see session.svelte.ts) — this one-off random run can only be
	 * reproduced by sharing its `?s=` link, since it isn't derivable from
	 * today's seed.
	 */
	function playAgain() {
		if (!session.config) return;
		const shuffled = randomShuffleCountries(game.countries);
		dailyRecordWritten = false;
		if (session.config.mode === 'quickplay') {
			session.startQuickplay(game.countries, session.config.rounds, shuffled.slice(0, session.config.rounds));
		} else {
			session.startTimed(game.countries, session.config.minutes, shuffled);
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

<main>
	<header>
		<div class="header-bar">
			<nav class="nav">
				{#if route.current === 'game'}
					{#if activeMode !== null}
						<button type="button" class="link-btn" onclick={backToModeSelect}>←</button>
					{:else}
						<a href="#/all">All flags</a>
					{/if}
					<a href="#/help">Help</a>
					<a href="#/about">About</a>
				{:else}
					<button type="button" class="link-btn" onclick={() => route.go('game')}>← Game</button>
					{#if route.current !== 'all'}<a href="#/all">All flags</a>{/if}
					{#if route.current !== 'help'}<a href="#/help">Help</a>{/if}
					{#if route.current !== 'about'}<a href="#/about">About</a>{/if}
				{/if}
			</nav>
			<button
				class="theme-toggle"
				title={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				aria-label={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
				onclick={() => theme.toggle()}
			>
				{#if theme.resolved === 'dark'}
					<!-- currently dark: show the unset option, light -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
					</svg>
				{:else}
					<!-- currently light: show the unset option, dark -->
					<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
					</svg>
				{/if}
			</button>
		</div>
		<h1>Convexity</h1>
		<p class="tagline">Guess the flag from its colour distribution.</p>
	</header>

	{#if route.current === 'help'}
		<HelpPage />
	{:else if route.current === 'about'}
		<AboutPage />
	{:else if game.loading}
		<p>Loading flags…</p>
	{:else if game.error}
		<p class="error">Failed to load dataset: {game.error}</p>
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
			targets={session.targets}
			results={session.results}
			origin={session.origin}
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

		<section class="chart-section">
			<ColorChart colors={game.target.colors} />
			{#if game.flashCountry && !game.over}
				<img class="flash-flag" src={flagUrl(game.flashCountry.cca2)} alt={game.flashCountry.name} />
			{/if}
		</section>

		<section class="hint-section">
			<HintPanel target={game.target} revealed={game.revealedHints} neighborName={(c) => game.neighborName(c)} />
		</section>

		{#if game.over}
			<section class="result">
				<img class="reveal-flag" src={flagUrl(game.target.cca2)} alt={game.target.name} />
				{#if game.won}
					<p class="win">🎉 It was {game.target.name}!</p>
				{:else}
					<p class="lose">The answer was {game.target.name}.</p>
				{/if}
				{#if activeMode === 'freeplay'}
					<button class="primary" onclick={() => game.newRound()}>Play again</button>
				{/if}
			</section>
		{:else}
			<section class="input-section">
				<SearchInput
					countries={game.countries}
					disabled={game.over}
					{alreadyGuessed}
					onSelect={(c) => game.guess(c)}
				/>
				<div class="input-actions">
					<button class="secondary" onclick={() => game.giveUp()}>Give up</button>
				</div>
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
	.header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.nav a,
	.link-btn {
		font-size: 0.85rem;
		color: var(--accent);
		text-decoration: none;
	}
	.link-btn {
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
	}
	.nav a:hover,
	.link-btn:hover {
		text-decoration: underline;
	}
	.theme-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: transparent;
		color: inherit;
		cursor: pointer;
		flex-shrink: 0;
	}
	.theme-toggle:hover {
		background: var(--accent-muted);
		border-color: var(--accent);
	}
	h1 {
		margin: 1rem 0 0.25rem;
		font-size: 2rem;
	}
	.tagline {
		margin: 0;
		opacity: 0.7;
	}
	.chart-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}
	.flash-flag {
		width: 8rem;
		height: auto;
		border-radius: 0.35rem;
		border: 1px solid var(--border);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}
	.reveal-flag {
		width: 10rem;
		height: auto;
		border-radius: 0.4rem;
		border: 1px solid var(--border);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
	}
	.hint-section {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: center;
	}
	.input-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		align-items: center;
	}
	.input-actions {
		display: flex;
		gap: 0.6rem;
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
