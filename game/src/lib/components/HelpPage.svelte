<div class="page">
	<h2>How to play</h2>
	<ol>
		<li>Every round picks a random country. You see only its flag's colour distribution — a pie or bar chart of the colours and how much of the flag they cover.</li>
		<li>Type a country into the search box and pick it to guess.</li>
		<li>A wrong guess scores a <strong>similarity</strong> — how close that country's colour distribution is to the target's — and unlocks a hint.</li>
		<li>Hints reveal in order: neighbouring countries, population, land area, then continent.</li>
		<li>After 4 hints you can keep guessing freely, or give up to reveal the answer.</li>
	</ol>

	<h2>Colour similarity</h2>
	<p>
		Similarity compares the two countries' colour palettes — matching hues and their proportions — not just
		shared colour names. An exact match scores 100%; unrelated palettes score low.
	</p>

	<h2>Game modes</h2>
	<p>
		<strong>Freeplay</strong> is unlimited, one round at a time. <strong>Quickplay</strong> plays a fixed number of
		rounds (5 or 10) back-to-back, then shows a results summary. <strong>Timed</strong> plays as many rounds as
		you can before the clock runs out; a round still in progress when time expires counts as unsolved.
	</p>
	<p>
		Quickplay and Timed use the same flag order for everyone playing that mode and setting on a given day, so you
		and a friend get a fair, identical challenge without needing to send each other anything. Once you've played
		a setting today, coming back to it shows your result instead of starting over — you can still replay it, or
		share it, from there.
	</p>

	<h2>Sharing results</h2>
	<p>
		After a Quickplay or Timed session, the results screen gives you an emoji summary (🟩 solved with no hints,
		🟨 solved with hints, 🟥 unsolved), the date you played, and a link. For your first attempt of the day, that
		link just points a friend at the same mode and setting — they get the same flags automatically just by
		playing today, no special key needed. <strong>Play again</strong> starts a brand-new, freshly randomized
		challenge (not a replay of what you just played); its share text links straight to that random run, since
		that's the only way anyone else can get the exact same one.
	</p>

	<h2>All flags</h2>
	<p>
		Browse every country's colour distribution and details on the <strong>All flags</strong> page, searchable by
		name — reachable from the mode-select screen before starting a round.
	</p>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 34rem;
	}
	h2 {
		margin: 0.75rem 0 0.25rem;
		font-size: 1.1rem;
	}
	h2:first-child {
		margin-top: 0;
	}
	p,
	ol {
		margin: 0;
		line-height: 1.5;
	}
	ol {
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
</style>
