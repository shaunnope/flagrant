<script lang="ts">
	import type { Country } from '../types';
	import { icon } from '../icons';

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
	{@html icon('search')}
	<input
		type="text"
		placeholder="Search for a country"
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
		max-width: 460px;
	}
	.search > :global(svg) {
		position: absolute;
		left: 13px;
		top: 13px;
		width: 18px;
		height: 18px;
		color: var(--muted-strong);
		pointer-events: none;
	}
	input {
		width: 100%;
		padding: 10px 14px 10px 40px;
		border-radius: var(--radius-btn);
		border: 1px solid var(--edge);
		background: var(--surface-strong);
		color: var(--ink);
		font-size: 16px;
		line-height: 22px;
	}
	input::placeholder {
		color: var(--muted-strong);
		opacity: 1;
	}
	.dropdown {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 10;
		list-style: none;
		padding: 4px;
		border-radius: var(--radius-control);
		border: 1px solid var(--surface-border);
		background: var(--surface-strong);
		-webkit-backdrop-filter: blur(18px);
		backdrop-filter: blur(18px);
		box-shadow: var(--shadow-glass);
		max-height: 16rem;
		overflow-y: auto;
		animation: drop var(--duration-open) var(--ease-out);
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
	.dropdown button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border-radius: var(--radius-seg);
		font-size: 16px;
		line-height: 22px;
		font-weight: 400;
	}
	.dropdown button.highlighted,
	.dropdown button:hover {
		background: var(--brand-fill);
		color: var(--on-brand);
	}
	.dropdown button.guessed {
		color: var(--muted-strong);
	}
	.dropdown button.highlighted.guessed,
	.dropdown button.guessed:hover {
		color: var(--on-brand);
	}
	.tag {
		font-size: 12.5px;
		line-height: 16px;
		font-weight: 600;
	}
</style>
