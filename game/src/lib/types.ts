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
