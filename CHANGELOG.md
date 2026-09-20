# Changelog

## Unreleased

### Added

- Committed `data/stack-overlay.json` (stack language + this-wake laws). `hydrateWritableSignals` copies the 8-name factory seed then merges overlay names additively into `.xray/state/repertoire/curated_signals.json`. Existing project names keep their stats. Factory seed SHA is unchanged.
- Overlay names ship on the 0.55 gate so `getTaskConfidence` routes stack language on a fresh clone. Do not pin 0.1.8.
- `hydrateWritableSignals` also merges the overlay when `signalsPath` is already the project dest (the wear path). Factory seed still refused.

## [0.2.1] - 2026-09-20

### Added

- Excess-above-gate confidence decay (14-day grace, 60-day half-life). Factory seed on the 0.55 gate stays routable. Project-local `validated` signals with fewer than 100 observations can demote when raw decay falls under the gate.
- Project `.cursor/hooks.json` wears sibling xray Cursor hooks (`XRAY_AI_PATH` override, default `../xray`) so the organ heats Station on Cursor Cloud.
- Project-local cadence names (`lead-cadence-syncopation`, `live-loop-not-pacer`, `peer-wears-without-commands`) so a peer lead routes the beat after compact.

### Fixed

- `hydrateWritableSignals` always copies the factory seed to `.xray/state/repertoire/curated_signals.json`, including when cwd is this organ repo. Dogfooding no longer mutates `data/curated_signals.json`.
- `CuratedSignalsManager.save` refuses the tarball seed path (`isFactorySeedFile`).
- `signals:hygiene` and `enrich` write the hydrated project copy, not the tarball. `--i-mean-it` means write the project copy.
- Organ-cwd writable defaults (`RepertoireService`, MCP, memory-routing provider, default `CuratedSignalsManager`) now use `.xray/state/repertoire/` for state, feedback, and logs — not `data/` or `logs/` inside the package.
