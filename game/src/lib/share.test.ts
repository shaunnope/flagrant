import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Country, RoundOutcome } from './types';
import { buildModeUrl, decodeModeUrl, decodeSession, encodeSession, solveDateText, summaryEmoji } from './share';

/** buildModeUrl/buildShareUrl read window.location — stub it for vitest's `node` test environment, which has no real `window`. */
function installWindowLocationStub() {
	(globalThis as { window?: unknown }).window = {
		location: { origin: 'https://example.test', pathname: '/' }
	};
}

function country(cca3: string, name = cca3): Country {
	return {
		cca2: cca3.slice(0, 2),
		cca3,
		name,
		region: 'Testland',
		subregion: '',
		continents: ['Testland'],
		population: 1000,
		area_km2: 100,
		landlocked: false,
		borders: [],
		capital: [],
		colors: [{ hex: '#ff0000', pct: 100 }]
	};
}

// A pool big enough to draw 10 distinct quickplay targets from. Real cca3
// codes are always 3 uppercase letters (never digits, which matters since
// the packed encoding is base-26 over A-Z) and are never literally "AAA"
// (which packs to the all-zero byte pair — a degenerate case whose base64
// rendering coincidentally reuses the letter 'A', not a real-world code).
const CCA3_CODES = [
	'USA', 'GBR', 'FRA', 'DEU', 'JPN', 'BRA', 'AUS', 'CAN', 'EGY', 'IND',
	'CHN', 'RUS', 'MEX', 'ITA', 'ESP', 'KOR', 'NGA', 'ARG', 'ZAF', 'SWE'
];
const POOL = CCA3_CODES.map((code) => country(code));

/** The old (feature 001) base64-of-JSON baseline, kept here only to assert the new encoding beats it. */
function legacyEncode(mode: 'quickplay' | 'timed', rounds: number | undefined, minutes: number | undefined, targets: Country[]): string {
	const payload =
		mode === 'quickplay' ? { m: 'quickplay', rounds, t: targets.map((c) => c.cca3) } : { m: 'timed', minutes, t: targets.map((c) => c.cca3) };
	return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('encodeSession / decodeSession (packed-byte format)', () => {
	it('round-trips a quickplay session: same mode, config, and exact target order', () => {
		const targets = POOL.slice(0, 5);
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, targets);
		const decoded = decodeSession(encoded, POOL);

		expect(decoded).not.toBeNull();
		expect(decoded!.config).toEqual({ mode: 'quickplay', rounds: 5 });
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(targets.map((c) => c.cca3));
	});

	it('round-trips a 10-round quickplay session', () => {
		const targets = POOL.slice(3, 13);
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 10 }, targets);
		const decoded = decodeSession(encoded, POOL);

		expect(decoded!.config).toEqual({ mode: 'quickplay', rounds: 10 });
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(targets.map((c) => c.cca3));
	});

	it.each([1, 3, 5] as const)('round-trips a %i-minute timed session', (minutes) => {
		const targets = [POOL[7], POOL[2], POOL[15]];
		const encoded = encodeSession('timed', { mode: 'timed', minutes }, targets);
		const decoded = decodeSession(encoded, POOL);

		expect(decoded!.config).toEqual({ mode: 'timed', minutes });
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(targets.map((c) => c.cca3));
	});

	it('drops target codes missing from the current country list instead of failing', () => {
		const targets = POOL.slice(0, 5);
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, targets);
		const decoded = decodeSession(encoded, POOL.slice(1)); // POOL[0] no longer known

		expect(decoded).not.toBeNull();
		expect(decoded!.targets.map((c) => c.cca3)).not.toContain(POOL[0].cca3);
		expect(decoded!.targets).toHaveLength(4);
	});

	it('returns null for a malformed/truncated payload', () => {
		expect(decodeSession('not-valid-base64!!!', POOL)).toBeNull();
		expect(decodeSession('', POOL)).toBeNull();
	});

	it('returns null when the byte count does not match the declared quickplay round count', () => {
		// Encode 5 rounds, then hand-truncate one target byte off the end.
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, POOL.slice(0, 5));
		const truncated = encoded.slice(0, -2); // drops roughly the last base64 chunk
		expect(decodeSession(truncated, POOL)).toBeNull();
	});

	it('returns null when every target index is out of range for the current country list', () => {
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, POOL.slice(0, 5));
		expect(decodeSession(encoded, [])).toBeNull();
	});
});

describe('packed-byte encoding is shorter and non-readable', () => {
	it('is shorter than the legacy base64-JSON encoding for an equivalent 10-round session', () => {
		const targets = POOL.slice(0, 10);
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 10 }, targets);
		const legacy = legacyEncode('quickplay', 10, undefined, targets);

		expect(encoded.length).toBeLessThan(legacy.length * 0.7); // at least 30% shorter (SC-001)
	});

	it('does not contain any target country cca3 code as a readable substring', () => {
		const targets = POOL.slice(0, 10);
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 10 }, targets);

		for (const c of targets) {
			expect(encoded).not.toContain(c.cca3);
		}
	});
});

describe('solveDateText', () => {
	it('formats a date as ISO YYYY-MM-DD', () => {
		expect(solveDateText(new Date(2026, 7, 31))).toBe('2026-08-31'); // Date month is 0-indexed: 7 = August
	});

	it('zero-pads single-digit months and days', () => {
		expect(solveDateText(new Date(2026, 0, 5))).toBe('2026-01-05');
	});

	it('defaults to the current date when none is given', () => {
		expect(solveDateText()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('buildModeUrl / decodeModeUrl (plain daily-origin mode link)', () => {
	beforeEach(() => installWindowLocationStub());
	afterEach(() => delete (globalThis as { window?: unknown }).window);

	it.each([
		['quickplay', { mode: 'quickplay', rounds: 5 }, 'mode=q5', { mode: 'quickplay', rounds: 5 }],
		['quickplay', { mode: 'quickplay', rounds: 10 }, 'mode=q10', { mode: 'quickplay', rounds: 10 }],
		['timed', { mode: 'timed', minutes: 1 }, 'mode=t1', { mode: 'timed', minutes: 1 }],
		['timed', { mode: 'timed', minutes: 3 }, 'mode=t3', { mode: 'timed', minutes: 3 }],
		['timed', { mode: 'timed', minutes: 5 }, 'mode=t5', { mode: 'timed', minutes: 5 }]
	] as const)('round-trips %s config through a compact %s key, no session data', (mode, config, expectedQuery, expectedDecoded) => {
		const url = buildModeUrl(mode, config);

		expect(url).not.toContain('?s=');
		expect(url).toContain(expectedQuery);
		expect(decodeModeUrl(new URL(url).searchParams)).toEqual(expectedDecoded);
	});

	it('returns null for a missing or unrecognized mode key', () => {
		expect(decodeModeUrl(new URLSearchParams())).toBeNull();
		expect(decodeModeUrl(new URLSearchParams('mode=freeplay'))).toBeNull();
		expect(decodeModeUrl(new URLSearchParams('mode=quickplay'))).toBeNull(); // old-style full name, no longer valid
		expect(decodeModeUrl(new URLSearchParams('mode=q7'))).toBeNull(); // not a real rounds option
	});
});

describe('daily-origin vs pinned-origin share text (FR-005a/FR-005b)', () => {
	beforeEach(() => installWindowLocationStub());
	afterEach(() => delete (globalThis as { window?: unknown }).window);

	// Mirrors the conditional assembly in ResultsSummary.svelte: a 'daily'
	// origin links straight to the mode (no session data); a 'pinned'
	// origin links to the exact pinned sequence via `?s=`.
	function assembleShareText(mode: 'quickplay' | 'timed', config: Parameters<typeof encodeSession>[1], targets: Country[], origin: 'daily' | 'pinned') {
		const emojiLine = 'x'.repeat(targets.length); // stand-in emoji line, length is what matters here
		const header = `Convexity ${mode === 'quickplay' ? 'Quickplay' : 'Timed'} — ${solveDateText()}`;
		const url = origin === 'pinned' ? `https://example.test/?s=${encodeSession(mode, config, targets)}` : buildModeUrl(mode, config);
		return `${header}\n${emojiLine}\n${url}`;
	}

	it('links to the mode (no ?s=) for a daily-origin share text', () => {
		const targets = POOL.slice(0, 5);
		const text = assembleShareText('quickplay', { mode: 'quickplay', rounds: 5 }, targets, 'daily');

		expect(text).not.toContain('?s=');
		expect(text).toContain('mode=q5');
		expect(text).toContain(solveDateText());
	});

	it('includes a ?s= pinned-session link for a pinned-origin share text', () => {
		const targets = POOL.slice(0, 5);
		const text = assembleShareText('quickplay', { mode: 'quickplay', rounds: 5 }, targets, 'pinned');

		expect(text).toContain('?s=');
		expect(text).toContain(solveDateText());
	});
});

describe('summaryEmoji', () => {
	it('maps each round outcome to its emoji, in order', () => {
		const [a, b, c] = POOL;
		const results: RoundOutcome[] = [
			{ target: a, result: 'solved-no-hints', hintsRevealed: 0 },
			{ target: b, result: 'solved-with-hints', hintsRevealed: 2 },
			{ target: c, result: 'unsolved', hintsRevealed: 4 }
		];
		expect(summaryEmoji(results)).toBe('🟩🟨🟥');
	});

	it('returns an empty string for no rounds', () => {
		expect(summaryEmoji([])).toBe('');
	});
});
