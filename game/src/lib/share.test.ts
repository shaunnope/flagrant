import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Country, RoundOutcome } from './types';
import { buildShareUrl, decodeShareCode, decodeShareUrl, encodeShareCode, solveDateText, summaryEmoji } from './share';

/** buildShareUrl reads window.location — stub it for vitest's `node` test environment, which has no real `window`. */
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

const POOL = ['USA', 'GBR', 'FRA', 'DEU', 'JPN', 'BRA'].map((code) => country(code));

describe('encodeShareCode / decodeShareCode', () => {
	it.each([
		[{ mode: 'quickplay', rounds: 5 }, 'Q5-'],
		[{ mode: 'quickplay', rounds: 10 }, 'Q10-'],
		[{ mode: 'timed', minutes: 1 }, 'T1-'],
		[{ mode: 'timed', minutes: 3 }, 'T3-'],
		[{ mode: 'timed', minutes: 5 }, 'T5-']
	] as const)('round-trips %j through a single readable value', (config, prefix) => {
		const code = encodeShareCode(config, 987654321, 'C7F2');

		expect(code.startsWith(prefix)).toBe(true);
		expect(decodeShareCode(code)).toEqual({ config, seed: 987654321, datasetHash: 'C7F2' });
	});

	it('round-trips the seed range edges', () => {
		for (const seed of [0, 1, 4294967295]) {
			expect(decodeShareCode(encodeShareCode({ mode: 'quickplay', rounds: 5 }, seed, 'C7F2'))?.seed).toBe(seed);
		}
	});

	it('is forgiving of case and surrounding whitespace', () => {
		const code = encodeShareCode({ mode: 'timed', minutes: 3 }, 1234, 'C7F2');
		expect(decodeShareCode(` ${code.toLowerCase()} `)?.seed).toBe(1234);
	});

	it('returns null for malformed codes', () => {
		expect(decodeShareCode('')).toBeNull();
		expect(decodeShareCode('Q5')).toBeNull();
		expect(decodeShareCode('Q7-BBBBBBB-C7F2')).toBeNull(); // not a real rounds option
		expect(decodeShareCode('freeplay-BBBBBBB-C7F2')).toBeNull();
		expect(decodeShareCode('Q5-BBBB-C7F2')).toBeNull(); // seed too short
		expect(decodeShareCode('Q5-AEIOU01-C7F2')).toBeNull(); // chars outside the alphabet
		expect(decodeShareCode('Q5-ZZZZZZZ-C7F2')).toBeNull(); // seed > 2^32 - 1
		expect(decodeShareCode('Q5-BBBBBBB-')).toBeNull(); // no dataset hash
	});
});

describe('buildShareUrl / decodeShareUrl', () => {
	beforeEach(() => installWindowLocationStub());
	afterEach(() => delete (globalThis as { window?: unknown }).window);

	it('puts everything in one `g` query value and nothing else', () => {
		const url = buildShareUrl({ mode: 'quickplay', rounds: 10 }, 4242, 'C7F2');
		const params = new URL(url).searchParams;

		expect([...params.keys()]).toEqual(['g']);
		expect(decodeShareUrl(params)).toEqual({ config: { mode: 'quickplay', rounds: 10 }, seed: 4242, datasetHash: 'C7F2' });
	});

	it('returns null when the param is missing or malformed', () => {
		expect(decodeShareUrl(new URLSearchParams())).toBeNull();
		expect(decodeShareUrl(new URLSearchParams('g=nonsense'))).toBeNull();
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
