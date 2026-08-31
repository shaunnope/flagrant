import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RoundOutcome } from './types';
import { dailyAttemptSlot, readDailyAttempt, writeDailyAttempt } from './dailyAttempt';

/**
 * Minimal `document.cookie` jar mock — good enough to exercise
 * dailyAttempt.ts's read/write logic under vitest's `node` environment,
 * which has no real `document`. Mirrors the one browser behavior this
 * module relies on: setting `document.cookie = "name=value; attrs..."`
 * upserts just that one cookie; reading `document.cookie` returns all
 * cookies joined as "name=value; name2=value2" (no attributes).
 */
function installCookieJarStub() {
	const jar = new Map<string, string>();
	(globalThis as { document?: unknown }).document = {
		get cookie() {
			return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
		},
		set cookie(raw: string) {
			const [pair] = raw.split(';');
			const eq = pair.indexOf('=');
			const name = pair.slice(0, eq);
			const value = pair.slice(eq + 1);
			jar.set(name, value);
		}
	};
	return jar;
}

beforeEach(() => {
	installCookieJarStub();
});

afterEach(() => {
	delete (globalThis as { document?: unknown }).document;
});

const OUTCOMES: RoundOutcome[] = [
	{
		target: {
			cca2: 'AA',
			cca3: 'AAA',
			name: 'Aland',
			region: '',
			subregion: '',
			continents: [],
			population: null,
			area_km2: null,
			landlocked: null,
			borders: [],
			capital: [],
			colors: []
		},
		result: 'solved-no-hints',
		hintsRevealed: 0
	}
];

describe('dailyAttemptSlot', () => {
	it('maps each mode+configuration to a distinct cookie key', () => {
		const slots = new Set([
			dailyAttemptSlot('quickplay', 5),
			dailyAttemptSlot('quickplay', 10),
			dailyAttemptSlot('timed', 1),
			dailyAttemptSlot('timed', 3),
			dailyAttemptSlot('timed', 5)
		]);
		expect(slots.size).toBe(5);
	});
});

describe('writeDailyAttempt / readDailyAttempt', () => {
	it('round-trips a record for its own mode+configuration', () => {
		writeDailyAttempt('quickplay', 5, OUTCOMES);
		const record = readDailyAttempt('quickplay', 5);

		expect(record).not.toBeNull();
		expect(record!.results).toEqual([{ result: 'solved-no-hints', hintsRevealed: 0 }]);
		expect(record!.d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('keeps each mode+configuration slot independent', () => {
		writeDailyAttempt('quickplay', 5, OUTCOMES);
		expect(readDailyAttempt('quickplay', 10)).toBeNull();
		expect(readDailyAttempt('timed', 1)).toBeNull();
	});

	it('returns null when no cookie has been written yet', () => {
		expect(readDailyAttempt('timed', 3)).toBeNull();
	});

	it('treats a record with a non-today date as stale and returns null', () => {
		const jar = installCookieJarStub();
		jar.set(dailyAttemptSlot('quickplay', 5), encodeURIComponent(JSON.stringify({ d: '2000-01-01', results: [] })));

		expect(readDailyAttempt('quickplay', 5)).toBeNull();
	});

	it('treats malformed JSON as absent rather than throwing', () => {
		const jar = installCookieJarStub();
		jar.set(dailyAttemptSlot('quickplay', 5), 'not-json{{{');

		expect(readDailyAttempt('quickplay', 5)).toBeNull();
	});
});
