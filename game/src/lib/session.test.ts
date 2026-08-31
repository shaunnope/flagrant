import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Country } from './types';
import { game } from './game.svelte';
import { session } from './session.svelte';
import * as seedModule from './seed';

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

	it('advances one round per resolution and ends the session after the configured count', () => {
		session.startQuickplay(COUNTRIES, 5);
		const [t0, t1, t2, t3, t4] = session.targets;

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

		// Round 3: wrong guess (reveals a hint) then correct -> solved-with-hints.
		const wrong = COUNTRIES.find((c) => c.cca3 !== t2.cca3)!;
		game.guess(wrong);
		expect(game.hintsRevealed).toBe(1);
		game.guess(t2);
		session.resolveRound();
		expect(session.results[2]).toEqual({ target: t2, result: 'solved-with-hints', hintsRevealed: 1 });
		expect(session.over).toBe(false);
		expect(game.target?.cca3).toBe(t3.cca3);

		// Round 4: correct guess, no hints.
		game.guess(t3);
		session.resolveRound();
		expect(session.roundIndex).toBe(4);
		expect(session.over).toBe(false);
		expect(game.target?.cca3).toBe(t4.cca3);

		// Round 5 (last): give up -> unsolved; session ends.
		game.giveUp();
		session.resolveRound();
		expect(session.results[4]).toEqual({ target: t4, result: 'unsolved', hintsRevealed: 0 });
		expect(session.roundIndex).toBe(5);
		expect(session.over).toBe(true);
	});
});

describe('Daily seeding', () => {
	it('produces the same target order for the same mode+config on repeated fresh starts', () => {
		session.startQuickplay(COUNTRIES, 5);
		const first = session.targets.map((c) => c.cca3);
		session.reset();
		session.startQuickplay(COUNTRIES, 5);
		const second = session.targets.map((c) => c.cca3);

		expect(first).toEqual(second);
		expect(session.origin).toBe('daily');
	});

	it('tags a session with a pinned `order` as origin "pinned"', () => {
		session.startQuickplay(COUNTRIES, 5, [COUNTRIES[2], COUNTRIES[0], COUNTRIES[1]]);
		expect(session.origin).toBe('pinned');
		expect(session.targets.map((c) => c.cca3)).toEqual(['CCC', 'AAA', 'BBB']);
	});

	it('reproduces a pinned sequence exactly regardless of the current date (Story 3 / SC-003)', () => {
		const pinnedOrder = [COUNTRIES[3], COUNTRIES[1], COUNTRIES[4]];

		const dateSpy = vi.spyOn(seedModule, 'todayLocalISODate').mockReturnValue('2026-08-31');
		session.startQuickplay(COUNTRIES, 5, pinnedOrder);
		const sameDayTargets = session.targets.map((c) => c.cca3);

		session.reset();
		dateSpy.mockReturnValue('2027-01-15'); // far-future date, simulating an opened link long after the fact
		session.startQuickplay(COUNTRIES, 5, pinnedOrder);
		const laterDayTargets = session.targets.map((c) => c.cca3);

		dateSpy.mockRestore();

		expect(sameDayTargets).toEqual(['DDD', 'BBB', 'EEE']);
		expect(laterDayTargets).toEqual(sameDayTargets);
	});

	it('extends a Timed queue deterministically past its initial batch rather than falling back to true randomness', () => {
		vi.useFakeTimers();
		session.startTimed(COUNTRIES, 1);
		const firstBatch = session.targets.map((c) => c.cca3);

		// Exhaust the initial batch (5 countries) to force a queue extension.
		for (let i = 0; i < firstBatch.length; i++) {
			game.guess(session.targets[session.roundIndex]);
			session.resolveRound();
		}
		expect(session.targets.length).toBeGreaterThan(firstBatch.length);
		const extendedOnce = session.targets.map((c) => c.cca3);

		// Re-run the same scenario from scratch and confirm the extension is identical (deterministic, not random).
		session.reset();
		session.startTimed(COUNTRIES, 1);
		for (let i = 0; i < firstBatch.length; i++) {
			game.guess(session.targets[session.roundIndex]);
			session.resolveRound();
		}
		expect(session.targets.map((c) => c.cca3)).toEqual(extendedOnce);
	});

	it('keeps a fixed target order in place when the calendar date changes mid-session (FR-003)', () => {
		const dateSpy = vi.spyOn(seedModule, 'todayLocalISODate').mockReturnValue('2026-08-31');
		try {
			session.startQuickplay(COUNTRIES, 5);
			const targetsAtStart = session.targets.map((c) => c.cca3);

			dateSpy.mockReturnValue('2026-09-01'); // simulate the day rolling over mid-session

			game.guess(session.targets[0]);
			session.resolveRound();

			expect(session.targets.map((c) => c.cca3)).toEqual(targetsAtStart);
		} finally {
			dateSpy.mockRestore();
		}
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
