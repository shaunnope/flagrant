import { describe, expect, it } from 'vitest';
import type { Country } from './types';
import { dailySeed, datasetHash, parseSeedCode, randomSeed, seededShuffleCountries, seedKey, seedToCode, shuffleBySeed, todayLocalISODate } from './seed';

function country(cca3: string): Country {
	return {
		cca2: cca3.slice(0, 2),
		cca3,
		name: cca3,
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

const COUNTRIES = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH', 'III', 'JJJ'].map(country);

describe('todayLocalISODate', () => {
	it('returns a YYYY-MM-DD string', () => {
		expect(todayLocalISODate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('seededShuffleCountries', () => {
	it('is deterministic: same date/mode/config always produce the same order', () => {
		const a = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES);
		const b = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES);
		expect(a.map((c) => c.cca3)).toEqual(b.map((c) => c.cca3));
	});

	it('produces a permutation of the input pool (same elements, same length)', () => {
		const shuffled = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES);
		expect(shuffled).toHaveLength(COUNTRIES.length);
		expect(new Set(shuffled.map((c) => c.cca3))).toEqual(new Set(COUNTRIES.map((c) => c.cca3)));
	});

	it('does not mutate the input array', () => {
		const before = COUNTRIES.map((c) => c.cca3);
		seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES);
		expect(COUNTRIES.map((c) => c.cca3)).toEqual(before);
	});

	it('differs between different calendar days for the same mode+config (general case)', () => {
		const day1 = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES).map((c) => c.cca3);
		const day2 = seededShuffleCountries('2026-09-01', 'quickplay', 5, COUNTRIES).map((c) => c.cca3);
		expect(day1).not.toEqual(day2);
	});

	it('differs between different configs on the same day (general case)', () => {
		const rounds5 = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES).map((c) => c.cca3);
		const rounds10 = seededShuffleCountries('2026-08-31', 'quickplay', 10, COUNTRIES).map((c) => c.cca3);
		expect(rounds5).not.toEqual(rounds10);
	});

	it('differs between quickplay and timed for the same day/selector (general case)', () => {
		const qp = seededShuffleCountries('2026-08-31', 'quickplay', 5, COUNTRIES).map((c) => c.cca3);
		const timed = seededShuffleCountries('2026-08-31', 'timed', 5, COUNTRIES).map((c) => c.cca3);
		expect(qp).not.toEqual(timed);
	});

	it('differs between variants (used to extend a Timed queue) while staying deterministic per variant', () => {
		const v0 = seededShuffleCountries('2026-08-31', 'timed', 1, COUNTRIES, 0).map((c) => c.cca3);
		const v1a = seededShuffleCountries('2026-08-31', 'timed', 1, COUNTRIES, 1).map((c) => c.cca3);
		const v1b = seededShuffleCountries('2026-08-31', 'timed', 1, COUNTRIES, 1).map((c) => c.cca3);
		expect(v1a).not.toEqual(v0);
		expect(v1a).toEqual(v1b);
	});

	it('produces day-to-day variation over a rolling window (SC-002 guard against a degenerate seed)', () => {
		const orders = new Set<string>();
		for (let day = 1; day <= 30; day++) {
			const date = `2026-08-${String(day).padStart(2, '0')}`;
			orders.add(seededShuffleCountries(date, 'quickplay', 5, COUNTRIES).map((c) => c.cca3).join(','));
		}
		// At least 95% of the 30 days should produce a distinct order.
		expect(orders.size).toBeGreaterThanOrEqual(29);
	});
});

describe('shuffleBySeed', () => {
	it('is deterministic for a seed and a permutation of the pool', () => {
		const a = shuffleBySeed(12345, COUNTRIES).map((c) => c.cca3);
		expect(a).toEqual(shuffleBySeed(12345, COUNTRIES).map((c) => c.cca3));
		expect(new Set(a)).toEqual(new Set(COUNTRIES.map((c) => c.cca3)));
	});

	it('differs between seeds and between variants of one seed', () => {
		const base = shuffleBySeed(1, COUNTRIES).map((c) => c.cca3);
		expect(shuffleBySeed(2, COUNTRIES).map((c) => c.cca3)).not.toEqual(base);
		expect(shuffleBySeed(1, COUNTRIES, 1).map((c) => c.cca3)).not.toEqual(base);
	});
});

describe('randomSeed / seedToCode / parseSeedCode', () => {
	it('round-trips a seed through its fixed-width code', () => {
		for (const seed of [0, 1, 35, 123456789, 4294967295, randomSeed()]) {
			const code = seedToCode(seed);
			expect(code).toHaveLength(7);
			expect(parseSeedCode(code)).toBe(seed);
		}
	});

	it('rejects malformed seed codes', () => {
		expect(parseSeedCode('')).toBeNull();
		expect(parseSeedCode('BBBB')).toBeNull(); // wrong width
		expect(parseSeedCode('AEIOU01')).toBeNull(); // outside the alphabet
		expect(parseSeedCode('9999999')).toBeNull(); // > 2^32 - 1
	});

	it('varies between calls (statistically)', () => {
		const seeds = new Set(Array.from({ length: 20 }, () => randomSeed()));
		expect(seeds.size).toBeGreaterThan(1);
	});
});

describe('datasetHash', () => {
	it('is a stable 4-char code that changes when the pool changes', () => {
		expect(datasetHash(COUNTRIES)).toHaveLength(4);
		expect(datasetHash(COUNTRIES)).toBe(datasetHash([...COUNTRIES]));
		expect(datasetHash(COUNTRIES.slice(1))).not.toBe(datasetHash(COUNTRIES));
	});
});

describe('seedKey / dailySeed', () => {
	it('produces a distinct key and seed per (date, mode, config) combination', () => {
		const args: [string, 'quickplay' | 'timed', number][] = [
			['2026-08-31', 'quickplay', 5],
			['2026-09-01', 'quickplay', 5],
			['2026-08-31', 'timed', 5],
			['2026-08-31', 'quickplay', 10]
		];
		expect(new Set(args.map((a) => seedKey(...a))).size).toBe(4);
		expect(new Set(args.map((a) => dailySeed(...a))).size).toBe(4);
	});
});
