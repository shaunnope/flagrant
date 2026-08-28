import type { Country, QuickplayRounds, RoundOutcome, SessionConfig, SharePayload, TimedMinutes } from './types';

const QUICKPLAY_ROUNDS: QuickplayRounds[] = [5, 10]; //, 20, 'all'];
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

/** Encodes a session's mode, config, and fixed target order into a compact URL-safe string for a `?s=` param. */
export function encodeSession(mode: 'quickplay' | 'timed', config: SessionConfig, targets: Country[]): string {
	const t = targets.map((c) => c.cca3);
	const payload: SharePayload =
		config.mode === 'quickplay' ? { m: 'quickplay', rounds: config.rounds, t } : { m: 'timed', minutes: config.minutes, t };
	// Payload is pure ASCII (JSON keys + cca3 codes), so a plain btoa is safe — no UTF-8 escaping needed.
	return toUrlSafe(btoa(JSON.stringify(payload)));
}

/** Builds a full shareable URL for the current page with the session encoded in `?s=`. */
export function buildShareUrl(mode: 'quickplay' | 'timed', config: SessionConfig, targets: Country[]): string {
	const encoded = encodeSession(mode, config, targets);
	return `${window.location.origin}${window.location.pathname}?s=${encoded}`;
}

/**
 * Decodes a `?s=` param back into a mode/config plus the resolved target
 * flags (looked up in `countries`; codes with no match are dropped). Returns
 * null on any structural or validation failure so callers can fall back
 * gracefully (spec FR-014).
 */
export function decodeSession(param: string, countries: Country[]): { config: SessionConfig; targets: Country[] } | null {
	let payload: unknown;
	try {
		payload = JSON.parse(atob(fromUrlSafe(param)));
	} catch {
		return null;
	}

	if (typeof payload !== 'object' || payload === null) return null;
	const p = payload as Record<string, unknown>;
	if (!Array.isArray(p.t) || !p.t.every((c) => typeof c === 'string')) return null;

	const byCode = new Map(countries.map((c) => [c.cca3, c]));
	const targets = (p.t as string[]).map((code) => byCode.get(code)).filter((c): c is Country => c != null);
	if (targets.length === 0) return null;

	if (p.m === 'quickplay' && QUICKPLAY_ROUNDS.includes(p.rounds as QuickplayRounds)) {
		return { config: { mode: 'quickplay', rounds: p.rounds as QuickplayRounds }, targets };
	}
	if (p.m === 'timed' && TIMED_MINUTES.includes(p.minutes as TimedMinutes)) {
		return { config: { mode: 'timed', minutes: p.minutes as TimedMinutes }, targets };
	}
	return null;
}

const RESULT_EMOJI = { 'solved-no-hints': '🟩', 'solved-with-hints': '🟨', unsolved: '🟥' } as const;

/** One emoji per round, in order, for the share text (Wordle-style outcome grid). */
export function summaryEmoji(results: RoundOutcome[]): string {
	return results.map((r) => RESULT_EMOJI[r.result]).join('');
}
