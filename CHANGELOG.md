# Changelog

## Unreleased

### Added

- Excess-above-gate confidence decay (14-day grace, 60-day half-life). Factory seed on the 0.55 gate stays routable. Project-local `validated` signals with fewer than 100 observations can demote when raw decay falls under the gate.

### Fixed

- `hydrateWritableSignals` always copies the factory seed to `.xray/state/repertoire/curated_signals.json`, including when cwd is this organ repo. Dogfooding no longer mutates `data/curated_signals.json`.
- `CuratedSignalsManager.save` refuses the tarball seed path (`isFactorySeedFile`).
- `signals:hygiene` and `enrich` write the hydrated project copy, not the tarball. `--i-mean-it` means write the project copy.
