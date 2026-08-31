export interface FlagColor {
	hex: string;
	pct: number;
}

export interface Country {
	cca2: string;
	cca3: string;
	name: string;
	region: string;
	subregion: string;
	continents: string[];
	population: number | null;
	area_km2: number | null;
	landlocked: boolean | null;
	borders: string[];
	capital: string[];
	colors: FlagColor[];
}

export type HintKind = 'neighbors' | 'population' | 'size' | 'continent';

export const HINT_ORDER: HintKind[] = ['neighbors', 'population', 'size', 'continent'];

export interface Guess {
	country: Country;
	similarity: number;
	correct: boolean;
}

/** flagcdn.com PNG URL for a country's flag, by cca2 code. */
export function flagUrl(cca2: string, width = 320): string {
	return `https://flagcdn.com/w${width}/${cca2.toLowerCase()}.png`;
}

/** Freeplay is the existing endless single-round mode; the other two are session-based. */
export type GameMode = 'freeplay' | 'quickplay' | 'timed';

export type QuickplayRounds = 5 | 10; // | 20 | 'all';
export type TimedMinutes = 1 | 3 | 5;

/** Player-chosen configuration for a session-based mode (freeplay has none). */
export type SessionConfig =
	| { mode: 'quickplay'; rounds: QuickplayRounds }
	| { mode: 'timed'; minutes: TimedMinutes };

export type RoundResult = 'solved-no-hints' | 'solved-with-hints' | 'unsolved';

/** One resolved round within a session, kept for the results summary. */
export interface RoundOutcome {
	target: Country;
	result: RoundResult;
	hintsRevealed: number;
}

/**
 * Where a session's target order came from:
 * - 'daily': today's date+mode+config-seeded order (a fresh mode-select start).
 * - 'pinned': an exact, previously-fixed sequence — either an opened `?s=`
 *   link or a "Play again" replay. Not reshuffled, not seed-derived at start.
 */
export type SessionOrigin = 'daily' | 'pinned';

/** One resolved round's outcome, compact enough to persist in a cookie (no full Country). */
export interface DailyAttemptOutcome {
	result: RoundResult;
	hintsRevealed: number;
}

/**
 * Device-local record of today's first attempt at a given mode+configuration,
 * persisted as a cookie (one per mode+configuration). Powers the weak gate:
 * revisiting an already-attempted mode+configuration today re-shows this
 * instead of starting a new session.
 */
export interface DailyAttemptRecord {
	/** ISO local date (YYYY-MM-DD) this record was written; a record whose `d` isn't today's date is stale/ignored. */
	d: string;
	results: DailyAttemptOutcome[];
}
