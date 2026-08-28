import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Country } from './types';
import { game } from './game.svelte';
import { session } from './session.svelte';

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

const COUNTRIES = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'].map(country);

beforeEach(() => {
	game.countries = COUNTRIES;
});

afterEach(() => {
	session.reset();
	vi.useRealTimers();
});

describe('Quickplay round sequencing', () => {
	it('picks exactly N targets drawn from the loaded countries for a fixed round count', () => {
		session.startQuickplay(COUNTRIES, 5);
		expect(session.targets).toHaveLength(5);
		for (const t of session.targets) expect(COUNTRIES).toContain(t);
		expect(game.target?.cca3).toBe(session.targets[0].cca3);
	});

	it("'all' plays every country exactly once", () => {
		session.startQuickplay(COUNTRIES, 'all');
		expect(session.targets).toHaveLength(COUNTRIES.length);
		expect(new Set(session.targets.map((c) => c.cca3))).toEqual(new Set(COUNTRIES.map((c) => c.cca3)));
	});

	it('advances one round per resolution and ends the session after the configured count', () => {
		const THREE = COUNTRIES.slice(0, 3);
		session.startQuickplay(THREE, 'all');
		const [t0, t1, t2] = session.targets;

		// Round 1: correct guess, no hints -> solved-no-hints.
		game.guess(t0);
		expect(game.over).toBe(true);
		session.resolveRound();
		expect(session.results).toEqual([{ target: t0, result: 'solved-no-hints', hintsRevealed: 0 }]);
		expect(session.roundIndex).toBe(1);
		expect(session.over).toBe(false);
		expect(game.target?.cca3).toBe(t1.cca3);

		// Round 2: give up -> unsolved.
		game.giveUp();
		session.resolveRound();
		expect(session.results[1]).toEqual({ target: t1, result: 'unsolved', hintsRevealed: 0 });
		expect(game.target?.cca3).toBe(t2.cca3);

		// Round 3: wrong guess (reveals a hint) then correct -> solved-with-hints; session ends.
		const wrong = COUNTRIES.find((c) => c.cca3 !== t2.cca3)!;
		game.guess(wrong);
		expect(game.hintsRevealed).toBe(1);
		game.guess(t2);
		session.resolveRound();
		expect(session.results[2]).toEqual({ target: t2, result: 'solved-with-hints', hintsRevealed: 1 });
		expect(session.roundIndex).toBe(3);
		expect(session.over).toBe(true);
	});
});

describe('Timed session', () => {
	beforeEach(() => vi.useFakeTimers());

	it('counts down and does not end the session before time runs out', () => {
		session.startTimed(COUNTRIES, 1);
		expect(session.remainingMs).toBe(60_000);

		vi.advanceTimersByTime(5_000);
		expect(session.remainingMs).toBe(55_000);
		expect(session.over).toBe(false);
	});

	it('scores an in-progress round as unsolved and ends the session when the timer expires', () => {
		session.startTimed(COUNTRIES, 1);
		const target = session.targets[0];

		vi.advanceTimersByTime(60_000);

		expect(session.remainingMs).toBe(0);
		expect(session.over).toBe(true);
		expect(session.results).toEqual([{ target, result: 'unsolved', hintsRevealed: 0 }]);
	});

	it('resolving a round before expiry advances play and keeps the timer running', () => {
		session.startTimed(COUNTRIES, 1);
		const t0 = session.targets[0];

		vi.advanceTimersByTime(5_000);
		game.guess(t0);
		session.resolveRound();

		expect(session.results).toEqual([{ target: t0, result: 'solved-no-hints', hintsRevealed: 0 }]);
		expect(session.over).toBe(false);
		expect(game.target?.cca3).toBe(session.targets[1].cca3);

		vi.advanceTimersByTime(55_000);
		expect(session.over).toBe(true); // remaining time from the first tick ran out
	});
});
