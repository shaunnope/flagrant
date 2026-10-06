<script lang="ts">
	import { theme, COLOR_THEMES, type ModePreference } from '../theme.svelte';
	import { icon } from '../icons';

	let { open, onClose }: { open: boolean; onClose: () => void } = $props();

	const MODES: { id: ModePreference; label: string; icon: string }[] = [
		{ id: 'light', label: 'Light', icon: 'sun' },
		{ id: 'dark', label: 'Dark', icon: 'moon' },
		{ id: 'system', label: 'System', icon: 'system' }
	];

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') onClose();
	}

	$effect(() => {
		document.body.classList.toggle('modal-open', open);
		return () => document.body.classList.remove('modal-open');
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="modal-backdrop"
	class:hidden={!open}
	role="presentation"
	onclick={onClose}
>
	<div
		class="modal glass"
		role="dialog"
		aria-modal="true"
		aria-labelledby="theme-title"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="modal-head">
			<h2 id="theme-title">Theme</h2>
			<button class="icon-btn small" type="button" aria-label="Close" onclick={onClose}>
				{@html icon('close')}
			</button>
		</div>

		<!-- <p class="modal-label">Mode</p> -->
		<div class="mode-toggle">
			{#each MODES as m (m.id)}
				<button
					class="mode-btn"
					type="button"
					aria-pressed={theme.preference === m.id}
					onclick={() => theme.setPreference(m.id)}
				>
					{@html icon(m.icon)}{m.label}
				</button>
			{/each}
		</div>
		{#if theme.preference === 'system'}
			<p class="mode-note">Following your device. Currently {theme.mode}.</p>
		{/if}

		<!-- <p class="modal-label">Accent colour</p>
		<div class="swatch-grid">
			{#each COLOR_THEMES as t (t.id)}
				<button
					class="swatch"
					type="button"
					style:--sw={t.hex}
					aria-pressed={theme.color === t.id}
					onclick={() => theme.setColor(t.id)}
				>
					<i></i>{t.label}
				</button>
			{/each}
		</div> -->
	</div>
</div>

<style>
	.modal {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.modal-head h2 {
		font-size: 18px;
		color: var(--brand-ink);
	}
	.modal-label {
		margin-top: 4px;
		font-size: 13.5px;
		font-weight: 600;
		color: var(--muted-strong);
	}
	.mode-note {
		font-size: 13.5px;
		color: var(--muted-strong);
	}
	.mode-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 6px;
		padding: 4px;
		border-radius: var(--radius-control);
		background: var(--surface);
	}
	.mode-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px;
		border-radius: var(--radius-seg);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--muted-strong);
		transition: background var(--duration-quick) ease, color var(--duration-quick) ease;
	}
	.mode-btn :global(svg) {
		width: 16px;
		height: 16px;
	}
	.mode-btn[aria-pressed='true'] {
		background: var(--brand-fill);
		color: var(--on-brand);
	}
	.swatch-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.swatch {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px;
		border-radius: var(--radius-control);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		font-size: 12.5px;
		text-align: left;
	}
	.swatch[aria-pressed='true'] {
		border-color: var(--sw);
		box-shadow:
			0 0 0 2px var(--sw),
			0 0 0 3px color-mix(in srgb, var(--ink) 50%, transparent);
	}
	.swatch i {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--sw);
		border: 1px solid color-mix(in srgb, var(--ink) 30%, transparent);
		flex-shrink: 0;
	}
</style>
