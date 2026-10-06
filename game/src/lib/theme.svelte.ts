// Theme store: 7 brand swatches x light/dark, with a mode preference of
// light, dark or system. Replaces game/src/lib/theme.svelte.ts.
// Default is system + cobalt: a first visit follows the OS, and a person who
// picks Light or Dark keeps it whatever the OS does afterwards.

export const APP_KEY = 'flagrant';

export const COLOR_THEMES = [
	{ id: 'cobalt', label: 'Cobalt', hex: '#d4ddff' },
	{ id: 'vermilion', label: 'Vermilion', hex: '#ffd4cc' },
	{ id: 'saffron', label: 'Saffron', hex: '#ffeab8' },
	{ id: 'verdant', label: 'Verdant', hex: '#cdeccf' },
	{ id: 'lagoon', label: 'Lagoon', hex: '#c6eef0' },
	{ id: 'amethyst', label: 'Amethyst', hex: '#e6d6f7' },
	{ id: 'plain', label: 'Plain', hex: '#ffffff' }
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]['id'];
export type ModePreference = 'light' | 'dark' | 'system';
export type Mode = 'light' | 'dark';

const KEY_COLOR = `${APP_KEY}.colorTheme`;
const KEY_MODE = `${APP_KEY}.mode`;
const LEGACY_KEY = 'theme'; // the old store: light | dark | system

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function write(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* private mode: the choice lasts for this visit */
	}
}

function storedColor(): ColorTheme {
	const v = read(KEY_COLOR);
	return COLOR_THEMES.some((t) => t.id === v) ? (v as ColorTheme) : 'cobalt';
}

function isPreference(v: string | null): v is ModePreference {
	return v === 'light' || v === 'dark' || v === 'system';
}

function storedPreference(): ModePreference {
	const v = read(KEY_MODE);
	if (isPreference(v)) return v;
	// One-time move from the old key; its three values map across as they are.
	const legacy = read(LEGACY_KEY);
	if (isPreference(legacy)) {
		write(KEY_MODE, legacy);
		try {
			localStorage.removeItem(LEGACY_KEY);
		} catch {
			/* ignore */
		}
		return legacy;
	}
	return 'system';
}

const darkQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;

class ThemeStore {
	color = $state<ColorTheme>(storedColor());
	preference = $state<ModePreference>(storedPreference());
	private systemDark = $state(darkQuery?.matches ?? false);

	/** What the document is in. Only ever light or dark. */
	mode = $derived<Mode>(this.preference === 'system' ? (this.systemDark ? 'dark' : 'light') : this.preference);

	constructor() {
		// Follow the OS live: a phone switching to dark at sunset, or someone
		// flipping it in settings, changes the page with no reload. Only
		// matters while the preference is 'system', but tracking it always
		// keeps the derived mode right the moment someone picks System.
		darkQuery?.addEventListener('change', (e) => {
			this.systemDark = e.matches;
		});
		$effect.root(() => {
			$effect(() => this.apply());
		});
	}

	setColor(id: ColorTheme) {
		this.color = id;
		write(KEY_COLOR, id);
	}

	/** Stores the preference, never the resolved mode, so 'system' keeps following the OS. */
	setPreference(pref: ModePreference) {
		this.preference = pref;
		write(KEY_MODE, pref);
	}

	private apply() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		root.setAttribute('data-color-theme', this.color);
		root.setAttribute('data-mode', this.mode);
		root.setAttribute('data-mode-preference', this.preference);
	}
}

export const theme = new ThemeStore();
