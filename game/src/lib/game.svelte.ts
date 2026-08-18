import type { Country, Guess, HintKind } from './types';
import { HINT_ORDER } from './types';
import { colorSimilarity } from './similarity';

const MAX_HINTS = 4;
const FLASH_MS = 1500;

class GameState {
	countries = $state<Country[]>([]);
	loading = $state(true);
	error = $state<string | null>(null);

	target = $state<Country | null>(null);
	guesses = $state<Guess[]>([]);
	hintsRevealed = $state(0);
	won = $state(false);
	gaveUp = $state(false);

	/** Briefly shows the flag of whatever was just guessed. */
	flashCountry = $state<Country | null>(null);
	private flashTimer: ReturnType<typeof setTimeout> | undefined;

	/** Hints unlock one per wrong guess, capped at MAX_HINTS. */
	revealedHints = $derived<HintKind[]>(HINT_ORDER.slice(0, this.hintsRevealed));
	/** Past the 4th hint the player can guess as many times as they like, or give up. */
	unlimitedGuesses = $derived(this.hintsRevealed >= MAX_HINTS);
	over = $derived(this.won || this.gaveUp);

	async init() {
		try {
			const res = await fetch(`${import.meta.env.BASE_URL}flags.json`);
			if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
			const data: Country[] = await res.json();
			// A handful of countries ship with too few decoded pixels (near-blank
			// PNGs) to make a fair puzzle; require at least one real colour.
			this.countries = data.filter((c) => c.colors.length > 0);
			this.loading = false;
			this.newRound();
		} catch (e) {
			this.error = e instanceof Error ? e.message : String(e);
			this.loading = false;
		}
	}

	newRound() {
		this.target = this.countries[Math.floor(Math.random() * this.countries.length)];
		this.guesses = [];
		this.hintsRevealed = 0;
		this.won = false;
		this.gaveUp = false;
		clearTimeout(this.flashTimer);
		this.flashCountry = null;
	}

	guess(country: Country) {
		if (!this.target || this.over) return;

		const correct = country.cca3 === this.target.cca3;
		const similarity = correct ? 100 : colorSimilarity(country.colors, this.target.colors);
		this.guesses = [{ country, similarity, correct }, ...this.guesses];

		clearTimeout(this.flashTimer);
		this.flashCountry = country;
		if (!correct) {
			this.flashTimer = setTimeout(() => (this.flashCountry = null), FLASH_MS);
		}

		if (correct) {
			this.won = true;
			return;
		}
		if (this.hintsRevealed < MAX_HINTS) {
			this.hintsRevealed += 1;
		}
	}

	giveUp() {
		if (this.over) return;
		this.gaveUp = true;
	}

	/** Resolves a border cca3 code to a country name, for the neighbours hint. */
	neighborName(cca3: string): string {
		return this.countries.find((c) => c.cca3 === cca3)?.name ?? cca3;
	}
}

export const game = new GameState();
