import type { FlagColor } from './types';

/** Coarse hue buckets colours are classified into before comparing distributions. */
const BUCKETS = [
	'black',
	'white',
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'cyan',
	'blue',
	'purple',
	'pink'
] as const;
type Bucket = (typeof BUCKETS)[number];

function hexToHsl(hex: string): { h: number; s: number; l: number } {
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };

	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	switch (max) {
		case r:
			h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
			break;
		case g:
			h = ((b - r) / d + 2) * 60;
			break;
		default:
			h = ((r - g) / d + 4) * 60;
	}
	return { h, s, l };
}

/** Classifies a hex colour into one of the coarse buckets, by hue/sat/lightness. */
export function classify(hex: string): Bucket {
	const { h, s, l } = hexToHsl(hex);
	if (l < 0.12) return 'black';
	if (l > 0.92 && s < 0.15) return 'white';
	if (s < 0.15) return 'gray';
	if (h < 15 || h >= 345) return 'red';
	if (h < 45) return 'orange';
	if (h < 70) return 'yellow';
	if (h < 170) return 'green';
	if (h < 200) return 'cyan';
	if (h < 255) return 'blue';
	if (h < 290) return 'purple';
	return 'pink';
}

/** Reduces a flag's colour list to a fixed-length bucket-coverage vector. */
function bucketVector(colors: FlagColor[]): Record<Bucket, number> {
	const vec = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
	for (const c of colors) {
		vec[classify(c.hex)] += c.pct;
	}
	return vec;
}

/**
 * Similarity between two flags' colour distributions, 0-100.
 * Buckets each flag's colours into coarse hue groups, then scores by total
 * variation distance between the two coverage vectors: 100 * (1 - TVD).
 * Identical distributions -> 100; completely disjoint -> 0.
 */
export function colorSimilarity(a: FlagColor[], b: FlagColor[]): number {
	const va = bucketVector(a);
	const vb = bucketVector(b);
	let diff = 0;
	for (const bucket of BUCKETS) {
		diff += Math.abs(va[bucket] - vb[bucket]);
	}
	return Math.max(0, 100 - diff / 2);
}
