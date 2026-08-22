# Convexity Constitution

## Core Principles

### I. Deterministic Data Pipeline
The `dataset-gen` pipeline (fetch metadata → download flags → derive colour
distributions) MUST be deterministic: identical inputs (same `countries.json` + 
same flag SVGs) MUST produce byte-identical `flags.json` output. Colour
extraction MUST prefer declared SVG fill/stroke values over pixel sampling,
falling back to quantization only when no solid colours exist. Any change to
extraction/quantization logic MUST document its effect on output (e.g. via a
regenerated `dataset/flags.json` diff) so downstream game correctness is
auditable.
**Rationale**: the game's core mechanic (colour-distribution guessing) is
only fair and reproducible if the dataset generation is not incidentally
random or environment-dependent.

### II. Type Safety End-to-End
Rust code (`dataset-gen`) MUST compile with no `unwrap()`/`expect()` on
network or file I/O paths without justified error handling; use `Result` and
propagate errors. Frontend code (`game/`) MUST be TypeScript with `npm run
check` passing (no `any` used to silence real type errors) before a change is
considered done. Shared data shapes (the `flags.json` schema) MUST be
reflected in `game/src/lib/types.ts` and kept in sync with what
`dataset-gen` emits.
**Rationale**: the dataset is the contract between two different languages/
runtimes; type drift silently breaks the game at runtime with no compiler to
catch it.

### III. Simplicity (Static, No Backend)
The game MUST remain a static, client-only Svelte/Vite app with no server-side
runtime, database, or auth. All game state lives in-browser (Svelte 5 runes).
New features MUST be justified against this constraint before introducing a
backend, API server, or persistent storage — prefer static JSON + client
logic first.
**Rationale**: this is a small guessing game; a backend adds operational
burden (hosting, auth, uptime) disproportionate to the problem it would
solve.

### IV. Reproducible, Committed Artifacts
`dataset/flags.json` is a committed build artifact, not a generated-on-demand
file — it MUST be regenerated and committed (and mirrored to
`game/public/flags.json`) whenever `dataset-gen` logic or its inputs change.
Raw fetched inputs (`dataset-gen/data/countries.json`, cached flag PNGs) stay
gitignored; only the derived dataset is checked in.
**Rationale**: the game must run (`npm run dev`/`build`) without requiring
API keys or network access to `restcountries.com`/flag CDNs at build time.

### V. Minimal Dependencies
New dependencies (Rust crates, npm packages) MUST earn their place: prefer
what's already in `Cargo.toml`/`package.json` (reqwest, image, serde;
Svelte 5, Vite, TypeScript, LayerChart) before adding another library for
overlapping functionality. Charting stays on LayerChart unless a concrete
capability gap is identified.
**Rationale**: keeps the dataset-gen binary and the frontend bundle small and
the dependency surface auditable for a solo/small-team project.

### VI. Testing Scope
Unit tests are REQUIRED for pure, deterministic logic — colour extraction/
quantization and dataset assembly in `dataset-gen` (`cargo test`), and
similarity scoring in `game/src/lib/similarity.ts` (via `vitest`, added as a
devDependency the first time a test is written). Network/file-I/O code
(`fetch_metadata.rs`, flag downloading in `dataset-gen`) and Svelte UI
components are EXEMPT from unit-test coverage; they are validated instead by
the manual regeneration/`npm run check`+`build` steps in Development
Workflow. A change to similarity scoring or colour extraction/quantization
MUST include or update a unit test in the same commit — untested changes to
these two areas MUST NOT merge.
**Rationale**: these two algorithms are the game's fairness contract (same
input → same score/dataset every time); everything else (network calls, DOM)
is cheaper to verify by running the app than by mocking.

## Additional Constraints

- **Tech stack is fixed** per README: Rust (`dataset-gen`) for data
  generation; Svelte 5 + Vite + TypeScript + LayerChart for the frontend.
  Swapping any of these requires updating README's "Tech stack" section in
  the same change.
- **Data source attribution**: country metadata comes from restcountries.com
  v5 (requires `RESTCOUNTRIES_KEY`); flag images from a public CDN, no key
  required. Do not hardcode secrets — `.env` (gitignored) holds
  `RESTCOUNTRIES_KEY`, following `.env.example`.
- **Similarity scoring** (11 coarse hue buckets, total variation distance,
  `100 × (1 − TVD)`) is a documented, user-facing game rule — changing the
  scoring formula is a gameplay-affecting change and MUST be called out
  explicitly in the PR/commit, not bundled silently into an unrelated fix.

## Development Workflow

- Before submitting a frontend change: run `npm run check` (type-check) in
  `game/`; run `npx vitest run` if `similarity.ts` changed; run `npm run
  build` if the change could affect the production build (e.g. asset paths,
  Vite config).
- Before submitting a dataset-gen change: run `cargo test` if colour
  extraction/quantization or dataset-assembly logic changed; run the
  affected binary (`cargo run --release --bin fetch-metadata` and/or
  `--bin dataset-gen`) and verify `dataset/flags.json` regenerates sanely;
  copy it to `game/public/flags.json` per Principle IV.
- Keep commits scoped: dataset/schema changes and frontend-only changes
  SHOULD be separate commits/PRs unless the frontend change is required to
  consume a schema change.

## Governance

This constitution supersedes ad-hoc practice for this repository. Amendments
are made by editing this file directly (small project, no separate approval
body): update the affected principle(s), bump the version per the rules
below, and update `Last Amended`.

**Versioning policy** (semantic versioning applied to governance):
- **MAJOR**: backward-incompatible removal or redefinition of a principle
  (e.g. dropping the "no backend" constraint).
- **MINOR**: a new principle or materially expanded guidance added.
- **PATCH**: wording clarifications, typo fixes, non-semantic edits.

**Compliance review**: any change touching `dataset-gen` or the `flags.json`
schema should be checked against Principles I, II, and IV before merge; any
change adding a dependency or server-side component should be checked
against Principles III and V; any change to similarity scoring or colour
extraction/quantization should be checked against Principle VI.

**Version**: 1.0.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-22
