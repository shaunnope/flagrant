# Convexity

Convexity is a game about guessing flags based on their colour distribution,
represented as a pie chart or bar chart.

## How to play

1. A chart shows the colour distribution of a mystery country's flag —
   no shapes, no icons, just proportions of colour.
2. Search for a country and submit a guess.
3. Each wrong guess reveals a similarity score (how close your guess's colour
   distribution is to the answer's) and unlocks the next hint, in order:
   1. Neighboring countries
   2. Population
   3. Size (area)
   4. Continent
4. After the 4th hint, guess as many times as you like, or give up to reveal
   the answer.

## Project structure

```
flagrant/
├── dataset-gen/        # Rust: builds the game's dataset
│   ├── src/
│   │   ├── fetch_metadata.rs  # bin: pulls country metadata from restcountries API
│   │   └── main.rs            # bin: downloads flags, extracts colour distributions
│   └── data/
│       ├── countries.json     # fetched metadata (gitignored input to dataset-gen)
│       └── flags/              # cached flag PNGs (gitignored)
├── dataset/
│   └── flags.json      # generated dataset — output of dataset-gen, input to the game
└── game/                # Svelte + Vite + TypeScript frontend
    ├── public/
    │   └── flags.json   # copy of dataset/flags.json, served statically
    └── src/
        ├── lib/
        │   ├── game.svelte.ts     # round/guess state (Svelte 5 runes)
        │   ├── similarity.ts      # colour-distribution similarity scoring
        │   ├── types.ts
        │   └── components/
        │       ├── ColorChart.svelte   # pie/bar toggle
        │       ├── SearchInput.svelte  # search + dropdown guess input
        │       ├── HintPanel.svelte
        │       └── GuessList.svelte
        └── App.svelte
```

## Building the dataset

The dataset is generated in two steps, both Rust binaries in the
`dataset-gen` crate. `dataset/flags.json` is committed, so you only need to
re-run these if you want to refresh the source data.

### 1. Fetch country metadata

Pulls population, area, region/continent, capital, and border data from the
[restcountries](https://restcountries.com) v5 API, and writes
`dataset-gen/data/countries.json`.

Requires an API key:

```sh
cp .env.example .env
# edit .env and set RESTCOUNTRIES_KEY (get one at https://restcountries.com/plans)
```

Then run:

```sh
cargo run --release --bin fetch-metadata
```

### 2. Generate the colour-distribution dataset

Reads `dataset-gen/data/countries.json`, downloads each country's flag PNG
(cached under `dataset-gen/data/flags/`), quantizes each flag's pixels into
its dominant colours, and writes `dataset/flags.json`.

```sh
cargo run --release --bin dataset-gen
```

No API key needed for this step — flag images are fetched from a public CDN.

Whenever `dataset/flags.json` changes, copy it into the game's public dir:

```sh
cp dataset/flags.json game/public/flags.json
```

## Running the game

```sh
cd game
npm install
npm run dev       # dev server with hot reload
npm run build     # production build to game/dist/
npm run check     # type-check
```

## Tech stack

- **Dataset generation:** Rust (`reqwest`, `image`, `serde`)
- **Frontend:** Svelte 5 (runes) + Vite + TypeScript
- **Charts:** [LayerChart](https://www.layerchart.com/)
- **Data source:** [restcountries.com](https://restcountries.com) API v5
  (metadata) + flag CDN (images)

## Notes on the dataset

- Flags are sourced as SVGs and rasterized at a fixed width. Every declared 
  fill/stroke colour in the SVG is collected as the flag's true palette, and 
  each rendered pixel is snapped to its nearest palette entry — this eliminates 
  anti-aliasing noise outright, since a rasterized edge pixel is only ever a 
  blend *between* declared colours. Falls back to quantizing pixels into a reduced 
  colour space (4 bits/channel) when an SVG has no solid colours to snap to (pure
  gradients/patterns).
- The top colours covering ≥99.95% of the flag (max 16) are kept and
  normalized to sum to 100%.
- Guess similarity buckets both flags' colours into 11 coarse hue groups
  (black, white, gray, red, orange, yellow, green, cyan, blue, purple, pink)
  and scores by total variation distance between the two coverage vectors —
  `100 × (1 − TVD)`. Identical distributions score 100; completely disjoint
  ones score 0.
