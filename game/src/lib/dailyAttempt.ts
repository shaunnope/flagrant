import type { DailyAttemptRecord, QuickplayRounds, RoundOutcome, TimedMinutes } from './types';
import { todayLocalISODate } from './seed';

/** One cookie key per mode+configuration — 5 total, independently gated (spec FR-011). */
type DailyAttemptSlot = 'fq_dq5' | 'fq_dq10' | 'fq_dt1' | 'fq_dt3' | 'fq_dt5';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 2; // 2 days — backstop only; the `d` field is the real staleness check.

/** Maps a mode+configuration to its dedicated cookie key. */
export function dailyAttemptSlot(mode: 'quickplay' | 'timed', configSelector: QuickplayRounds | TimedMinutes): DailyAttemptSlot {
	return (mode === 'quickplay' ? `fq_dq${configSelector}` : `fq_dt${configSelector}`) as DailyAttemptSlot;
}

function readCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Path=/`;
}

/**
 * Reads today's Daily Attempt Record for a mode+configuration. Returns null
 * if absent, malformed, or stale (its `d` isn't today's local date) — a
 * stale/absent record never gates play (spec Assumptions).
 */
export function readDailyAttempt(mode: 'quickplay' | 'timed', configSelector: QuickplayRounds | TimedMinutes): DailyAttemptRecord | null {
	const raw = readCookie(dailyAttemptSlot(mode, configSelector));
	if (!raw) return null;
	try {
		const record = JSON.parse(raw) as DailyAttemptRecord;
		if (!record || typeof record.d !== 'string' || !Array.isArray(record.results)) return null;
		if (record.d !== todayLocalISODate()) return null;
		return record;
	} catch {
		return null;
	}
}

/** Writes today's first-attempt outcomes for a mode+configuration. */
export function writeDailyAttempt(mode: 'quickplay' | 'timed', configSelector: QuickplayRounds | TimedMinutes, results: RoundOutcome[]) {
	const record: DailyAttemptRecord = {
		d: todayLocalISODate(),
		results: results.map((r) => ({ result: r.result, hintsRevealed: r.hintsRevealed }))
	};
	writeCookie(dailyAttemptSlot(mode, configSelector), JSON.stringify(record));
}
