# Changelog

## Unreleased

## [0.2.6] - 2026-09-23

### Fixed

- Heat touches `last_seen` and does not append a confidence sample.
- A diary hit is the signal id, or that id with hyphens read as spaces.
- A session score below `0.55` is dropped. Constructing the organ does not append workspace samples.
- Stack overlay refresh keeps observation stats.

## [0.2.5] - 2026-09-22

### Added

- **Subject overlay:** `data/subject-overlay.json` (14 workspace organ/hangar names). `hydrateWritableSignals` merges it after the stack overlay. `reloadOpProc` stays factory + stack only — subject names are dest memory, not OP-PROC.
- **Flesh generic `repo-*` stubs:** `mergeSubjectOverlay` and `syncWorkspaceRepos` replace field-observed slug definitions with overlay or sibling `package.json` description. Existing subject flesh is not overwritten.
- **Kernel diary heat:** `collectKernelDiaryText` + `heatKernelDiary` warm existing dest names from kernel logs/state. No new colon pattern ids.
- Float-safe 0.55 gate + `x402` / `repo-*` tail retrieve so live dest actually routes subject language.

### Fixed

- Scaffold package names (`vite_react_shadcn_ts`) slug from the directory (`repo-chrono-warp-drive`), not the Vite template.
- Groover experiment names (`criteria_selection_gap`, `external_norm_smuggling_risk`, `model-latent-geometry-as-true-invariant`) are refused as field primitives.

### Not this

- Do not pin 0.1.8. Do not dump 145. Groover is not the producer. Do not republish 0.2.4.

## [0.2.4] - 2026-09-22

### Added

- **OP-PROC reload:** `reloadOpProc()` hydrates the project dest and lists factory + overlay names. Those names *are* OP-PROC. After compact the suit reloads them from dest / `.xray/state/repertoire-working.json`, not from Station.
- **0xRay kernel ingest:** `XraySessionIngester` now proposes dest names from session-capture (`session-*.json` patterns + matched primitives) and heats overlay names that appear in the session text. `discoverXrayKernelDirs` walks this project and sibling `docs/inference` / `.xray/inference`. Groover field dirs stay refused.
- **Workspace map:** `discoverSiblingRepos` / `syncWorkspaceRepos` observe `repo-<slug>` for each sibling `package.json`. Hangars stay hangars — remembered, not suited.
- Cursor heat `approaches` stay on the session inference entry so dest can warm overlay names on re-ingest.

### Not this

- Do not restore the 0.1.8 188-name dump. Do not encode OP-PROC onto Station.md. Do not publish 0.2.3 as if it were 20-repo deep memory.

## [0.2.3] - 2026-09-21

### Added

- Field memory loop on the **project dest**: `recordPrimitiveObservations` proposes unknown enriched names that pass the 0.55 gate (`field-observed`). Heading-dump names (`phase-3-…`, `7-final-statement`) are refused.
- `discoverFieldLogDirs` + `RepertoireService.syncFieldMemory` ingest **explicit** field JSONL (`REPERTOIRE_FIELD_LOGS`). Auto-sync is on outside Vitest. **Groover is not Repertoire** — sibling `../groover/` and `research/groover-inference-logs*` are not default sources.
- Ingest marks `processedPostIds` / comments / sessions on the project inference-state file.

### Fixed

- `health:repertoire`, `ingest`, and `enrich` read `.xray/state/repertoire/` (writable dest + logs), not package `logs/groover-inference` or `data/inference-state.json`.
- `verify-synthesis-dogfood` no longer sets `REPERTOIRE_EXPECTED_SIGNALS=145` (old dump-parity). Health is dest-available, not a 145 count.

### Not this

- Do not pin `0.1.8`. Do not copy Groover's 145-name `repertoire-brain` dump. Factory seed stays 8 names.
- Groover was a broken experiment of how this organ was supposed to work. Growing dest from Groover field is not Repertoire becoming real.

## [0.2.2] - 2026-09-20

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
