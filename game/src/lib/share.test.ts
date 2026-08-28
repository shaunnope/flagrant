import { describe, expect, it } from 'vitest';
import type { Country, RoundOutcome } from './types';
import { decodeSession, encodeSession, summaryEmoji } from './share';

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

const A = country('AAA');
const B = country('BBB');
const C = country('CCC');
const COUNTRIES = [A, B, C];

describe('encodeSession / decodeSession', () => {
	it('round-trips a quickplay session: same mode, config, and exact target order', () => {
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, [B, A, C]);
		const decoded = decodeSession(encoded, COUNTRIES);

		expect(decoded).not.toBeNull();
		expect(decoded!.config).toEqual({ mode: 'quickplay', rounds: 5 });
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(['BBB', 'AAA', 'CCC']);
	});

	it('round-trips a timed session', () => {
		const encoded = encodeSession('timed', { mode: 'timed', minutes: 3 }, [C, B]);
		const decoded = decodeSession(encoded, COUNTRIES);

		expect(decoded).not.toBeNull();
		expect(decoded!.config).toEqual({ mode: 'timed', minutes: 3 });
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(['CCC', 'BBB']);
	});

	it('drops target codes missing from the current country list instead of failing', () => {
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, [A, B, C]);
		const decoded = decodeSession(encoded, [A, C]); // B no longer known

		expect(decoded).not.toBeNull();
		expect(decoded!.targets.map((c) => c.cca3)).toEqual(['AAA', 'CCC']);
	});

	it('returns null for a malformed/truncated payload', () => {
		expect(decodeSession('not-valid-base64!!!', COUNTRIES)).toBeNull();
		expect(decodeSession('', COUNTRIES)).toBeNull();
	});

	it('returns null for an unknown/unsupported mode', () => {
		const bogus = btoa(JSON.stringify({ m: 'bogus', t: ['AAA'] })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(decodeSession(bogus, COUNTRIES)).toBeNull();
	});

	it('returns null when every target code is unknown', () => {
		const encoded = encodeSession('quickplay', { mode: 'quickplay', rounds: 5 }, [A]);
		expect(decodeSession(encoded, [B, C])).toBeNull();
	});
});

describe('summaryEmoji', () => {
	it('maps each round outcome to its emoji, in order', () => {
		const results: RoundOutcome[] = [
			{ target: A, result: 'solved-no-hints', hintsRevealed: 0 },
			{ target: B, result: 'solved-with-hints', hintsRevealed: 2 },
			{ target: C, result: 'unsolved', hintsRevealed: 4 }
		];
		expect(summaryEmoji(results)).toBe('🟩🟨🟥');
	});

	it('returns an empty string for no rounds', () => {
		expect(summaryEmoji([])).toBe('');
	});
});
