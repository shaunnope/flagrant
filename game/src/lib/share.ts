import type { Country, QuickplayRounds, RoundOutcome, SessionConfig, TimedMinutes } from './types';

const TIMED_MINUTES: TimedMinutes[] = [1, 3, 5];

/** Base64 -> URL-safe base64 (no padding). */
function toUrlSafe(b64: string): string {
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** URL-safe base64 -> standard base64 (re-adds padding). */
function fromUrlSafe(s: string): string {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
	const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
	return b64 + pad;
}

function bytesToBase64Url(bytes: number[]): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return toUrlSafe(btoa(bin));
}

function base64UrlToBytes(s: string): number[] {
	const bin = atob(fromUrlSafe(s));
	const bytes: number[] = [];
	for (let i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i));
	return bytes;
}

/**
 * A cca3 code packed as a base-26 letter-triplet integer (A=0..Z=25), split
 * into 2 bytes big-endian. This is a pure function of the code's own three
 * letters — unlike an index into a sorted country list, it's completely
 * independent of what dataset either side has loaded, so a code that's
 * genuinely missing on decode is the *only* thing that can go wrong (a
 * clean drop, not a silently-wrong neighbour) — no drift/reordering
 * fragility from dataset changes between sending and opening a link.
 */
function cca3ToBytes(cca3: string): [number, number] {
	const n = cca3
		.toUpperCase()
		.split('')
		.reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 65), 0);
	return [(n >> 8) & 0xff, n & 0xff];
}

function bytesToCca3(hi: number, lo: number): string {
	let n = (hi << 8) | lo;
	const chars: string[] = [];
	for (let i = 0; i < 3; i++) {
		chars.unshift(String.fromCharCode(65 + (n % 26)));
		n = Math.floor(n / 26);
	}
	return chars.join('');
}

/**
 * Encodes a session's mode, config, and fixed target order into a compact,
 * non-readable byte payload, base64url'd for a `?s=` param.
 *
 * Wire format (see data-model.md):
 *   byte 0 (header): bit 7 = mode (0 quickplay, 1 timed);
 *     quickplay: bit 6 = rounds selector (0 -> 5, 1 -> 10)
 *     timed:     bits 6-5 = minutes selector (00 -> 1, 01 -> 3, 10 -> 5)
 *   byte 1 (timed only): count of targets that follow
 *   remaining bytes: 2 bytes per target, its cca3 code packed as a
 *     base-26 letter-triplet integer (not the letters themselves).
 */
export function encodeSession(mode: 'quickplay' | 'timed', config: SessionConfig, targets: Country[]): string {
	const bytes: number[] = [];
	if (config.mode === 'quickplay') {
		bytes.push((config.rounds === 10 ? 1 : 0) << 6);
	} else {
		const minutesSel = TIMED_MINUTES.indexOf(config.minutes);
		bytes.push((1 << 7) | (minutesSel << 5));
		bytes.push(targets.length);
	}
	for (const t of targets) bytes.push(...cca3ToBytes(t.cca3));

	return bytesToBase64Url(bytes);
}

/** Builds a full shareable URL for the current page with the session encoded in `?s=`. */
export function buildShareUrl(mode: 'quickplay' | 'timed', config: SessionConfig, targets: Country[]): string {
	const encoded = encodeSession(mode, config, targets);
	return `${window.location.origin}${window.location.pathname}?s=${encoded}`;
}

/**
 * Decodes a `?s=` param back into a mode/config plus the resolved target
 * flags (looked up in `countries`; codes with no match in the current
 * dataset are dropped). Returns null on any structural or validation
 * failure so callers can fall back gracefully (spec FR-014, carried over).
 */
export function decodeSession(param: string, countries: Country[]): { config: SessionConfig; targets: Country[] } | null {
	let bytes: number[];
	try {
		bytes = base64UrlToBytes(param);
	} catch {
		return null;
	}
	if (bytes.length === 0) return null;

	const header = bytes[0];
	const mode: 'quickplay' | 'timed' = (header >> 7) & 1 ? 'timed' : 'quickplay';

	let config: SessionConfig;
	let codeBytes: number[];

	if (mode === 'quickplay') {
		const rounds = ((header >> 6) & 1) === 1 ? 10 : 5;
		codeBytes = bytes.slice(1);
		if (codeBytes.length !== rounds * 2) return null;
		config = { mode: 'quickplay', rounds };
	} else {
		const minutesSel = (header >> 5) & 0b11;
		if (minutesSel >= TIMED_MINUTES.length) return null;
		if (bytes.length < 2) return null;
		const count = bytes[1];
		codeBytes = bytes.slice(2);
		if (codeBytes.length !== count * 2) return null;
		config = { mode: 'timed', minutes: TIMED_MINUTES[minutesSel] };
	}

	const byCode = new Map(countries.map((c) => [c.cca3, c]));
	const targets: Country[] = [];
	for (let i = 0; i < codeBytes.length; i += 2) {
		const cca3 = bytesToCca3(codeBytes[i], codeBytes[i + 1]);
		const match = byCode.get(cca3);
		if (match) targets.push(match);
	}
	if (targets.length === 0) return null;

	return { config, targets };
}

/** Query-string shape read back by App.svelte's `?mode=` handling — see buildModeUrl/decodeModeUrl. */
export interface ModeLinkConfig {
	mode: 'quickplay' | 'timed';
	rounds?: QuickplayRounds;
	minutes?: TimedMinutes;
}

/** Compact `?mode=` value per mode+configuration: q5/q10 (Quickplay), t1/t3/t5 (Timed). */
const MODE_KEYS = { quickplay: { 5: 'q5', 10: 'q10' }, timed: { 1: 't1', 3: 't3', 5: 't5' } } as const;

/**
 * Builds a plain link to today's daily-seeded mode+configuration — no
 * session/target data, just a compact `?mode=` key (`q5`/`q10`/`t1`/`t3`/`t5`)
 * enough to redirect a visitor straight into that mode. Used for a
 * 'daily'-origin share instead of a `?s=` pinned-session link, since the
 * recipient gets the same flags automatically by playing that mode today.
 */
export function buildModeUrl(mode: 'quickplay' | 'timed', config: SessionConfig): string {
	const key = mode === 'quickplay' ? MODE_KEYS.quickplay[(config as { rounds: QuickplayRounds }).rounds] : MODE_KEYS.timed[(config as { minutes: TimedMinutes }).minutes];
	return `${window.location.origin}${window.location.pathname}?mode=${key}`;
}

const MODE_KEY_TO_CONFIG: Record<string, ModeLinkConfig> = {
	q5: { mode: 'quickplay', rounds: 5 },
	q10: { mode: 'quickplay', rounds: 10 },
	t1: { mode: 'timed', minutes: 1 },
	t3: { mode: 'timed', minutes: 3 },
	t5: { mode: 'timed', minutes: 5 }
};

/**
 * Parses a `?mode=` key (`q5`/`q10`/`t1`/`t3`/`t5`) into a validated
 * mode+configuration, or null if missing/unrecognized — mirrors
 * decodeSession's fail-gracefully contract for a malformed link.
 */
export function decodeModeUrl(params: URLSearchParams): ModeLinkConfig | null {
	const key = params.get('mode');
	if (!key) return null;
	return MODE_KEY_TO_CONFIG[key] ?? null;
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
