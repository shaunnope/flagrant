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

/** The composite key a day's seed is derived from: local date + mode + configuration selector (Quickplay round count, or Timed minutes). */
export function seedKey(date: string, mode: 'quickplay' | 'timed', configSelector: number): string {
	return `${date}|${mode}|${configSelector}`;
}

/** A day's seed for a mode+configuration: two different configs on the same day, or the same config on different days, get different seeds. */
export function dailySeed(date: string, mode: 'quickplay' | 'timed', configSelector: number): number {
	return hashString(seedKey(date, mode, configSelector));
}

/** A fresh random 32-bit seed, for a one-off ("Play again") run that's shareable by seed. */
export function randomSeed(): number {
	return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** No vowels and no 0/O/1/I, so a code can't spell a word or be misread. */
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
const SEED_CODE_LENGTH = 7; // 29^7 > 2^32
const HASH_CODE_LENGTH = 4;

function toCode(n: number, length: number): string {
	let out = '';
	for (let i = 0; i < length; i++) {
		out = CODE_ALPHABET[n % CODE_ALPHABET.length] + out;
		n = Math.floor(n / CODE_ALPHABET.length);
	}
	return out;
}

function fromCode(code: string): number | null {
	let n = 0;
	for (const ch of code) {
		const d = CODE_ALPHABET.indexOf(ch);
		if (d < 0) return null;
		n = n * CODE_ALPHABET.length + d;
	}
	return n;
}

/** Fixed-width, readable text form of a seed for share links. */
export function seedToCode(seed: number): string {
	return toCode(seed >>> 0, SEED_CODE_LENGTH);
}

/** Parses a `seedToCode` value back to a seed, or null if it isn't one. */
export function parseSeedCode(code: string): number | null {
	if (code.length !== SEED_CODE_LENGTH) return null;
	const n = fromCode(code);
	return n !== null && n < 4294967296 ? n : null;
}

/**
 * Short fingerprint of the country pool (hash of its cca3 codes, in dataset
 * order — the dataset is sorted by cca3 at generation time). A seed only
 * reproduces a sequence against the same pool, so share links carry this to
 * let a recipient detect a dataset mismatch instead of silently getting
 * different flags.
 */
export function datasetHash(countries: Country[]): string {
	return toCode(hashString(countries.map((c) => c.cca3).join(',')) % CODE_ALPHABET.length ** HASH_CODE_LENGTH, HASH_CODE_LENGTH);
}

/**
 * Deterministically shuffles `countries` for a seed — same seed + same pool
 * always gives the same order, on any client. The pool must be in the
 * dataset's canonical (cca3-sorted) order. `variant` > 0 yields further
 * distinct shuffles of the same seed, used to extend a Timed queue.
 */
export function shuffleBySeed(seed: number, countries: Country[], variant = 0): Country[] {
	const effective = variant === 0 ? seed : hashString(`${seed}|${variant}`);
	return seededShuffle(countries, mulberry32(effective));
}

/** Deterministically shuffles `countries` for a given (date, mode, config[, variant]) — the daily seed's shuffle. */
export function seededShuffleCountries(
	date: string,
	mode: 'quickplay' | 'timed',
	configSelector: number,
	countries: Country[],
	variant = 0
): Country[] {
	return shuffleBySeed(dailySeed(date, mode, configSelector), countries, variant);
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
