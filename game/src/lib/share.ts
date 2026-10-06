import { parseSeedCode, seedToCode } from './seed';
import type { RoundOutcome, SessionConfig } from './types';

/** Mode+configuration keys used in a share code: Q5/Q10 (Quickplay), T1/T3/T5 (Timed). */
const MODE_KEYS = { quickplay: { 5: 'Q5', 10: 'Q10' }, timed: { 1: 'T1', 3: 'T3', 5: 'T5' } } as const;

const MODE_KEY_TO_CONFIG: Record<string, SessionConfig> = {
	Q5: { mode: 'quickplay', rounds: 5 },
	Q10: { mode: 'quickplay', rounds: 10 },
	T1: { mode: 'timed', minutes: 1 },
	T3: { mode: 'timed', minutes: 3 },
	T5: { mode: 'timed', minutes: 5 }
};

/** Query param carrying the share code. */
const SHARE_PARAM = 'g';

/** What a share code decodes to. */
export interface ShareCode {
	config: SessionConfig;
	seed: number;
	/** Fingerprint of the dataset the sender played against; see `datasetHash`. */
	datasetHash: string;
}

/** `<mode>-<seed>-<dataset hash>`, e.g. `Q5-BXK4M9T-C7F2`: one readable value that fully describes a run. */
export function encodeShareCode(config: SessionConfig, seed: number, datasetHash: string): string {
	const key = config.mode === 'quickplay' ? MODE_KEYS.quickplay[config.rounds] : MODE_KEYS.timed[config.minutes];
	return `${key}-${seedToCode(seed)}-${datasetHash}`;
}

/** Parses a share code (forgiving of case and stray whitespace); null if malformed. */
export function decodeShareCode(code: string): ShareCode | null {
	const parts = code.trim().toUpperCase().split('-');
	if (parts.length !== 3) return null;
	const [key, seedCode, hash] = parts;
	const config = MODE_KEY_TO_CONFIG[key];
	const seed = parseSeedCode(seedCode);
	if (!config || seed === null || hash.length === 0) return null;
	return { config, seed, datasetHash: hash };
}

/** Full shareable URL for the current page: `?g=<share code>`. */
export function buildShareUrl(config: SessionConfig, seed: number, datasetHash: string): string {
	return `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${encodeShareCode(config, seed, datasetHash)}`;
}

/** Reads the share code from a query string, or null if absent/malformed. */
export function decodeShareUrl(params: URLSearchParams): ShareCode | null {
	const code = params.get(SHARE_PARAM);
	return code ? decodeShareCode(code) : null;
}

const RESULT_EMOJI = { 'solved-no-hints': '🟩', 'solved-with-hints': '🟨', unsolved: '🟥' } as const;

/** One emoji per round, in order, for the share text (Wordle-style outcome grid). */
export function summaryEmoji(results: RoundOutcome[]): string {
	return results.map((r) => RESULT_EMOJI[r.result]).join('');
}

/** Today's local date, formatted for share text: ISO `YYYY-MM-DD` — unambiguous across locales/timezones for text that travels outside its sharer's own context. */
export function solveDateText(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}
