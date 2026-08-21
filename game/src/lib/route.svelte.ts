export type Route = 'game' | 'all';

function parseRoute(): Route {
	return typeof window !== 'undefined' && window.location.hash === '#/all' ? 'all' : 'game';
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
		window.location.hash = route === 'all' ? '#/all' : '';
	}
}

export const route = new RouteStore();
