export type ThemePref = 'light' | 'dark' | 'system';
export type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStored(): ThemePref {
	if (typeof localStorage === 'undefined') return 'system';
	const v = localStorage.getItem(STORAGE_KEY);
	return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function systemPrefersDark(): boolean {
	return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(pref: ThemePref) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (pref === 'system') {
		root.removeAttribute('data-theme');
	} else {
		root.setAttribute('data-theme', pref);
	}
}

/** Tracks the active theme preference; resolves 'system' to the OS setting. */
class ThemeStore {
	pref = $state<ThemePref>(readStored());
	private systemDark = $state(systemPrefersDark());

	resolved = $derived<Resolved>(this.pref === 'system' ? (this.systemDark ? 'dark' : 'light') : this.pref);

	constructor() {
		apply(this.pref);
		if (typeof matchMedia !== 'undefined') {
			matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				this.systemDark = e.matches;
			});
		}
	}

	set(pref: ThemePref) {
		this.pref = pref;
		localStorage.setItem(STORAGE_KEY, pref);
		apply(pref);
	}

	/** Flips between light and dark, dropping any 'system' preference. */
	toggle() {
		this.set(this.resolved === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeStore();
