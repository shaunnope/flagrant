import type { Country, QuickplayRounds, RoundOutcome, RoundResult, SessionConfig, TimedMinutes } from './types';
import { game } from './game.svelte';

const TICK_MS = 1000;

/** Fisher-Yates shuffle; does not mutate the input. */
function shuffle<T>(arr: T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

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

	private countriesPool: Country[] = [];
	private timerId: ReturnType<typeof setInterval> | undefined;

	over = $derived(
		this.mode === 'quickplay'
			? this.roundIndex >= this.targets.length
			: this.mode === 'timed'
				? this.remainingMs !== null && this.remainingMs <= 0
				: false
	);

	active = $derived(this.mode !== null && !this.over);

	/** Starts a Quickplay session over a freshly shuffled slice of `countries` (or, with a pinned `order`, that exact sequence — used when opening a shared link). */
	startQuickplay(countries: Country[], rounds: QuickplayRounds, order?: Country[]) {
		this.stopTimer();
		this.countriesPool = countries;
		const shuffled = order ?? shuffle(countries);
		this.targets = shuffled.slice(0, rounds);
		this.mode = 'quickplay';
		this.config = { mode: 'quickplay', rounds };
		this.roundIndex = 0;
		this.results = [];
		this.remainingMs = null;
		if (this.targets.length > 0) game.setRoundByCode(this.targets[0].cca3);
	}

	/** Starts a Timed session; `order`, if given (from a shared link), seeds the initial target queue but the session still runs on the clock, not a fixed count. */
	startTimed(countries: Country[], minutes: TimedMinutes, order?: Country[]) {
		this.stopTimer();
		this.countriesPool = countries;
		this.targets = order ?? shuffle(countries);
		this.mode = 'timed';
		this.config = { mode: 'timed', minutes };
		this.roundIndex = 0;
		this.results = [];
		this.remainingMs = minutes * 60_000;
		if (this.targets.length > 0) game.setRoundByCode(this.targets[0].cca3);
		this.timerId = setInterval(() => this.tick(), TICK_MS);
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
			// Ran through the seeded/shuffled queue with time still on the clock — extend it.
			this.targets = [...this.targets, ...shuffle(this.countriesPool)];
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
	}
}

export const session = new SessionState();
