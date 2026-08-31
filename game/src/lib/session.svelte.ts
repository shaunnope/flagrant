import type { Country, QuickplayRounds, RoundOutcome, RoundResult, SessionConfig, SessionOrigin, TimedMinutes } from './types';
import { game } from './game.svelte';
import { seededShuffleCountries, todayLocalISODate } from './seed';

const TICK_MS = 1000;

/**
 * Drives a Quickplay or Timed session: a fixed, ordered sequence of target
 * flags played back-to-back via the shared `game` round engine. Freeplay
 * does not use this — it keeps using `game` directly.
 */
class SessionState {
	mode = $state<'quickplay' | 'timed' | null>(null);
	config = $state<SessionConfig | null>(null);
	/** Fixed at session start (or pinned by a shared link); never mutated after. */
	targets = $state<Country[]>([]);
	roundIndex = $state(0);
	results = $state<RoundOutcome[]>([]);
	/** Timed only; null for quickplay/no session. */
	remainingMs = $state<number | null>(null);
	/** 'daily' = today's seeded order (fresh mode-select start); 'pinned' = an exact fixed sequence (opened link, "Play again", or a rehydrated weak-gate result). */
	origin = $state<SessionOrigin>('daily');

	private countriesPool: Country[] = [];
	private timerId: ReturnType<typeof setInterval> | undefined;
	/** The date used to derive this session's seed, captured at start — a Timed queue extension keeps using this date even if the calendar day rolls over mid-session (FR-003). */
	private seedDate = '';
	/** Bumped each time a Timed queue is extended, so each extension batch is a distinct-but-deterministic shuffle of the same pool. */
	private extensionCount = 0;

	over = $derived(
		this.mode === 'quickplay'
			? this.roundIndex >= this.targets.length
			: this.mode === 'timed'
				? this.remainingMs !== null && this.remainingMs <= 0
				: false
	);

	active = $derived(this.mode !== null && !this.over);

	/** Starts a Quickplay session over today's date+config-seeded order (or, with a pinned `order`, that exact sequence — used when opening a shared link or "Play again"). */
	startQuickplay(countries: Country[], rounds: QuickplayRounds, order?: Country[]) {
		this.stopTimer();
		this.countriesPool = countries;
		this.seedDate = todayLocalISODate();
		this.extensionCount = 0;
		const ordered = order ?? seededShuffleCountries(this.seedDate, 'quickplay', rounds, countries);
		this.targets = ordered.slice(0, rounds);
		this.mode = 'quickplay';
		this.config = { mode: 'quickplay', rounds };
		this.roundIndex = 0;
		this.results = [];
		this.remainingMs = null;
		this.origin = order ? 'pinned' : 'daily';
		if (this.targets.length > 0) game.setRoundByCode(this.targets[0].cca3);
	}

	/** Starts a Timed session; `order`, if given (from a shared link or "Play again"), pins the initial target queue but the session still runs on the clock, not a fixed count. Without `order`, the queue starts from today's date+config-seeded order. */
	startTimed(countries: Country[], minutes: TimedMinutes, order?: Country[]) {
		this.stopTimer();
		this.countriesPool = countries;
		this.seedDate = todayLocalISODate();
		this.extensionCount = 0;
		this.targets = order ?? seededShuffleCountries(this.seedDate, 'timed', minutes, countries);
		this.mode = 'timed';
		this.config = { mode: 'timed', minutes };
		this.roundIndex = 0;
		this.results = [];
		this.remainingMs = minutes * 60_000;
		this.origin = order ? 'pinned' : 'daily';
		if (this.targets.length > 0) game.setRoundByCode(this.targets[0].cca3);
		this.timerId = setInterval(() => this.tick(), TICK_MS);
	}

	/**
	 * Populates session state directly from a Daily Attempt Record's
	 * reconstructed results, without advancing any round — used by the weak
	 * gate to re-show today's first attempt at a mode+configuration instead
	 * of starting a new session. Origin stays 'daily' since this is the same
	 * attempt, not a new pinned replay.
	 */
	hydrateFromRecord(config: SessionConfig, targets: Country[], outcomes: RoundOutcome[]) {
		this.stopTimer();
		this.countriesPool = [];
		this.seedDate = todayLocalISODate();
		this.extensionCount = 0;
		this.mode = config.mode;
		this.config = config;
		this.targets = targets;
		this.results = outcomes;
		this.roundIndex = targets.length;
		this.remainingMs = null;
		this.origin = 'daily';
	}

	private tick() {
		if (this.remainingMs === null || this.remainingMs <= 0) return;
		this.remainingMs = Math.max(0, this.remainingMs - TICK_MS);
		if (this.remainingMs <= 0) this.handleExpiry();
	}

	/** Timer hit zero: score any in-progress round as unsolved and end the session. */
	private handleExpiry() {
		this.stopTimer();
		if (game.target && !game.over) {
			this.results = [...this.results, { target: game.target, result: 'unsolved' as RoundResult, hintsRevealed: game.hintsRevealed }];
		}
	}

	/** Call once the active round has resolved (won or gave up) to record its outcome and advance. */
	resolveRound() {
		if (!game.target || !game.over || this.over) return;

		const result: RoundResult = game.gaveUp ? 'unsolved' : game.hintsRevealed === 0 ? 'solved-no-hints' : 'solved-with-hints';
		this.results = [...this.results, { target: game.target, result, hintsRevealed: game.hintsRevealed }];
		this.roundIndex += 1;

		if (this.over) {
			this.stopTimer();
			return;
		}
		if (this.mode === 'timed' && this.roundIndex >= this.targets.length) {
			// Ran through the seeded queue with time still on the clock — extend it
			// with another deterministic, seed-derived batch (FR-004) rather than
			// falling back to true randomness.
			this.extensionCount += 1;
			const minutes = (this.config as { mode: 'timed'; minutes: TimedMinutes }).minutes;
			this.targets = [...this.targets, ...seededShuffleCountries(this.seedDate, 'timed', minutes, this.countriesPool, this.extensionCount)];
		}
		game.setRoundByCode(this.targets[this.roundIndex].cca3);
	}

	private stopTimer() {
		clearInterval(this.timerId);
		this.timerId = undefined;
	}

	reset() {
		this.stopTimer();
		this.mode = null;
		this.config = null;
		this.targets = [];
		this.roundIndex = 0;
		this.results = [];
		this.remainingMs = null;
		this.origin = 'daily';
	}
}

export const session = new SessionState();
