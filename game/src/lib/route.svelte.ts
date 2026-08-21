export type Route = 'game' | 'all' | 'help' | 'about';

const HASHES: Record<Exclude<Route, 'game'>, string> = {
	all: '#/all',
	help: '#/help',
	about: '#/about'
};

function parseRoute(): Route {
	if (typeof window === 'undefined') return 'game';
	const hash = window.location.hash;
	return (Object.keys(HASHES) as Exclude<Route, 'game'>[]).find((r) => HASHES[r] === hash) ?? 'game';
}

/** Tiny hash-based router — hash-only so it needs no server-side rewrite on GitHub Pages. */
class RouteStore {
	current = $state<Route>(parseRoute());

	constructor() {
		if (typeof window === 'undefined') return;
		window.addEventListener('hashchange', () => {
			this.current = parseRoute();
		});
	}

	go(route: Route) {
		window.location.hash = route === 'game' ? '' : HASHES[route];
	}
}

export const route = new RouteStore();
