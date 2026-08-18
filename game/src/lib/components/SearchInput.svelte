<script lang="ts">
	import type { Country } from '../types';

	let {
		countries,
		disabled,
		alreadyGuessed,
		onSelect
	}: {
		countries: Country[];
		disabled: boolean;
		alreadyGuessed: Set<string>;
		onSelect: (c: Country) => void;
	} = $props();

	let query = $state('');
	let open = $state(false);
	let highlighted = $state(0);

	let matches = $derived(
		query.trim().length === 0
			? []
			: countries
					.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
					.sort((a, b) => a.name.localeCompare(b.name))
					.slice(0, 8)
	);

	function pick(c: Country) {
		onSelect(c);
		query = '';
		open = false;
		highlighted = 0;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open || matches.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = (highlighted + 1) % matches.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = (highlighted - 1 + matches.length) % matches.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			pick(matches[highlighted]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div class="search">
	<input
		type="text"
		placeholder="Guess a country..."
		{disabled}
		bind:value={query}
		oninput={() => {
			open = true;
			highlighted = 0;
		}}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 120)}
		onkeydown={onKeydown}
	/>
	{#if open && matches.length > 0}
		<ul class="dropdown">
			{#each matches as c, i (c.cca3)}
				<li>
					<button
						type="button"
						class:highlighted={i === highlighted}
						class:guessed={alreadyGuessed.has(c.cca3)}
						onmousedown={() => pick(c)}
					>
						{c.name}
						{#if alreadyGuessed.has(c.cca3)}<span class="tag">guessed</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.search {
		position: relative;
		width: 100%;
		max-width: 28rem;
	}
	input {
		width: 100%;
		padding: 0.6rem 0.9rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		color: inherit;
		font-size: 1rem;
	}
	.dropdown {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 0;
		right: 0;
		z-index: 10;
		list-style: none;
		margin: 0;
		padding: 0.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--border);
		background: var(--surface);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		max-height: 16rem;
		overflow-y: auto;
	}
	.dropdown button {
		display: flex;
		justify-content: space-between;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.6rem;
		border: none;
		background: transparent;
		color: inherit;
		border-radius: 0.35rem;
		cursor: pointer;
		font-size: 0.95rem;
	}
	.dropdown button.highlighted,
	.dropdown button:hover {
		background: var(--accent-muted);
	}
	.dropdown button.guessed {
		opacity: 0.55;
	}
	.tag {
		font-size: 0.7rem;
		opacity: 0.7;
	}
</style>
