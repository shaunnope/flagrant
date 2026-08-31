import type { Country } from './types';

/** Today's local calendar date as an ISO `YYYY-MM-DD` string (no time/zone component). */
export function todayLocalISODate(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** DJB2 string hash, folded to an unsigned 32-bit integer — fast, dependency-free, good enough for a non-cryptographic shuffle seed. */
function hashString(s: string): number {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = (h * 33) ^ s.charCodeAt(i);
	}
	return h >>> 0;
}

/** mulberry32: a small, fast, seeded 32-bit PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return function () {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher-Yates shuffle driven by a supplied `random()` source; does not mutate the input. */
function seededShuffle<T>(arr: T[], random: () => number): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * The composite key a day's seed is derived from: local date + mode +
 * configuration selector (Quickplay round count, or Timed minutes), plus an
 * optional variant (used to extend a Timed queue past its initial seeded
 * batch with more deterministic-but-distinct shuffles of the same pool).
 * Two different configs on the same day hash to different seeds, and the
 * same config on different days hashes to a different seed.
 */
export function seedKey(date: string, mode: 'quickplay' | 'timed', configSelector: number, variant = 0): string {
	return `${date}|${mode}|${configSelector}|${variant}`;
}

/** Deterministically shuffles `countries` for a given (date, mode, config[, variant]) — same inputs always produce the same order, on any client. */
export function seededShuffleCountries(
	date: string,
	mode: 'quickplay' | 'timed',
	configSelector: number,
	countries: Country[],
	variant = 0
): Country[] {
	const seed = hashString(seedKey(date, mode, configSelector, variant));
	return seededShuffle(countries, mulberry32(seed));
}

/**
 * True (non-deterministic) shuffle via `Math.random()` — the original,
 * pre-seeding randomization. Used only for "Play again": each replay is
 * meant to be a fresh, one-off challenge, not the same targets replayed nor
 * tied to today's seed, so its result can only be reproduced by sending the
 * `?s=` pinned-session link (never derivable from a `?mode=` link).
 */
export function randomShuffleCountries(countries: Country[]): Country[] {
	return seededShuffle(countries, Math.random);
}

/**
 * Reconstructs a full target sequence for a given (date, mode, config), long
 * enough to cover `minLength` rounds — mirrors the same initial-batch +
 * seeded-extension growth `session.svelte.ts` uses live, so a Daily Attempt
 * Record's outcomes (recorded by round index only, per data-model.md) can be
 * zipped back onto the correct targets even if the original Timed session
 * extended its queue past the first batch.
 */
export function reconstructDailySequence(
	date: string,
	mode: 'quickplay' | 'timed',
	configSelector: number,
	countries: Country[],
	minLength: number
): Country[] {
	let targets = seededShuffleCountries(date, mode, configSelector, countries);
	let variant = 0;
	while (targets.length < minLength) {
		variant += 1;
		targets = [...targets, ...seededShuffleCountries(date, mode, configSelector, countries, variant)];
	}
	return targets;
}
