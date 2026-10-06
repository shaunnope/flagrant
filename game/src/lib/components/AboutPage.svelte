<div class="prose glass">
	<h2>About Convexity</h2>
	<p>
		Convexity is a game about guessing flags from their colour distribution — no shapes, no icons, just
		proportions of colour rendered as a pie or bar chart.
	</p>

	<h2>Data</h2>
	<p>
		Each flag's palette comes from its SVG source. The SVG is rendered to a bitmap and every pixel is snapped to its nearest declared colour. 
		Coverage is then just the share of pixels assigned to each colour, kept down to the	handful that account for the flag and normalized to sum to 100%.
	</p>
	<p>
		Country metadata (population, area, region, borders, capital) comes from the
		<a href="https://restcountries.com" target="_blank" rel="noreferrer">restcountries.com</a> API. Flags courtesy of
		<a href="https://flagcdn.com" target="_blank" rel="noreferrer">FlagCDN</a>.
	</p>

	<h2>Built with</h2>
	<p>Svelte 5, Vite, TypeScript, and <a href="https://www.layerchart.com/" target="_blank" rel="noreferrer">LayerChart</a>.</p>
</div>

<style>
	.prose {
		max-width: none;
	}
	.prose h2 {
		margin-top: 8px;
	}
	.prose h2:first-child {
		margin-top: 0;
	}
	.prose p {
		line-height: 21px;
	}
</style>
