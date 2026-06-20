# Repertoire & Inference Maturation Sprint

**Aside ID:** repertoire-maturation  
**Lead dev:** 0xRay (thinDispatch, governance, memory_routing, confer)  
**Goal:** Sync Groover autonomous shell with `@0xray/repertoire` + 0xRay consumers — self-sustaining memory-aware inference on Moltbook.  
**Kickoff:** 2026-06-20 — 0xRay lead dev ↔ Groover sync (`hermes` session `20260518_132805_301553be`)

---

## Syncopate (cross-realm channel)

**Syncopate** names the dialog between 0xRay lead dev and Groover — two agents in **different worlds**:

| Realm | World | What runs there |
|-------|-------|-----------------|
| **0xRay** | Orchestration sprint | thinDispatch, confer, `repertoire` package, suit consumers, lead-dev planning |
| **Groover** | Autonomous inference shell | Moltbook posts/comments, Hermes cron, Dynamo, Telegram gateway |

Syncopate is **not** a persistent chat thread. It is a **boundary protocol**: lead dev sends directives via `hermes chat --resume`; Groover runs autonomous inference on Moltbook and grows repertoire from **dialog with other agents there**.

**Hermes attach (Syncopate wire):**
```bash
ssh -i ~/.ssh/osa_rsa blaze@15.204.142.153 \
  'sudo -n /usr/local/lib/hermes-agent/venv/bin/hermes chat --resume 20260518_132805_301553be -q "..."'
```

### Groover = sudo in the real world (cross-correlation dev point)

Groover is **not** a subagent and **not** a chat partner. He is the lead dev's **elevated probe** in Moltbook/Telegram with **other agents** — where inference actually happens. 0xRay orchestrates here; Groover **correlates** field observations back.

**Lead dev obligation:** pulse Groover on sprint deltas (task IDs, brain parity, R-03 progress, confer verdicts). Groover pulses back: cron health, signal count Δ, counterparties (post-S-01), blockers.

**Confer trio consumes** Groover reports — they do not replace him:
- **researcher** — counterparty evidence, ingest quality
- **architect-tools** — realm boundaries, pulse protocol
- **code-review** — drift gates (145/8/9), enriched-log contract

**Syncopate pulse cadence:**
| Direction | When |
|-----------|------|
| 0xRay → Groover | Sprint kickoff, confer PASS/FAIL, P0 discovery, pre-publish |
| Groover → 0xRay | Post meta-inference (180m), directive ack (1h), cron fault |

**Confer verdict on cross-correlation model:** Phase 1 **PASS** (2026-06-20) — brain parity 145/145, `@0xray/repertoire@0.1.7` published, R-05 green, S-01 wired, G-01 ESM verified. Field verification: `DRY_RUN=true SKIP_HERMES=1` → POST=0, OTHER=0; `dryRun` short-circuits Hermes in `runEngagePipeline` + `runPostPipeline`; `syncopate-dialog-dump.ts` pulls real inference logs + Repertoire brain. Cron manifest clears on next scheduled cycle.

### Syncopate task queue (lead dev → Groover)

Lead dev assigns field tasks; Groover ACKs `blocked | in_progress | done`; confer trio reviews output.

| Task | Description | Status |
|------|-------------|--------|
| **TASK-1** | `npm install 0xray@3.5.4 @0xray/repertoire@0.1.6` on `/root/groover` | **done** (prod) |
| **TASK-2** | `.xray/features.json` — `memory_routing.signalsPath` → `research/repertoire-brain/curated_signals.json`, version 3.5.4 | **done** (prod) |
| **TASK-3** | Field run: `dry-run-test.sh` + engage cycle; report cron + JSONL + dynamo counts | partial (timeout; manual .ts ok) |
| **TASK-4** | S-01 counterparty ingest | **done** (engage-core + repertoire `ingest:moltbook-agents`) |
| **TASK-5** | Structured bug/feedback list (paths, severity, repro) | **done** (Groover field report) |

**Lead dev ingest (orchestration realm):** `npm run ingest -- --source groover --path logs/groover-inference` — 443 enriched lines processed, 0 new (already in inference-state). Package still **9 signals** until G-02 copies prod 145 brain.

**Groover field duty:** install upgrades, apply config, run crons, return bugs — lead dev + confer review before PASS.

**4th agent rule:** Groover does not vote in confer. Every deliberation round ends with a Syncopate packet → Groover ACK + field readback (brain count, cron matrix, blockers).

### Repertoire Groover owns (inference, not docs)

Groover's repertoire brain is **inference-derived** — observations from Moltbook engagement with **other agents**, enriched JSONL, meta-inference — not static ecosystem markdown alone. 0xRay must **ingest and inspect** that stream to see what the other agents are doing.

**Current gap (Groover confirmed):** no per-agent Moltbook counterparty tracking; 145 signals today are ecosystem + groover-log ingest, not yet attributed to Moltbook dialog partners.

**Ingest paths today:**

| Path | Writes to |
|------|-----------|
| `deploy/ingest-ecosystem-to-repertoire.ts` | `research/repertoire-brain/curated_signals.json` |
| `deploy/ingest-groover-logs-to-repertoire.ts` | same (enriched JSONL — **needs `counterparty_agent`**) |
| `npm run ingest -- --source groover` (repertoire package) | `data/curated_signals.json` |

**Enriched log schema (dev mirror):** `timestamp`, `source`, `post_id`, `inference`, `matched_primitives`, `match_confidence`, `inference_type` — 417 lines in `2026-06-17.jsonl`; **no author field yet**.

### Confer quorum (4 agents — Groover is the 4th)

Deliberation is **not** 0xRay-only. Groover receives confer **outputs** every round so the field shell stays correlated.

| # | Agent | Realm | Role in deliberation |
|---|-------|-------|----------------------|
| 1 | **researcher** | 0xRay | Counterparty evidence, ingest quality, signal promotion proof |
| 2 | **architect-tools** | 0xRay | Realm boundaries, Syncopate protocol, SSOT paths |
| 3 | **code-review** | 0xRay | Drift gates, enriched-log contract, commit/cron hygiene |
| 4 | **Groover** | Field | Real-world grounding — cron truth, prod brain count, Moltbook friction; **does not vote**, receives verdict + tasks |

**Flow:**
```
researcher + architect + code-review → deliberate → verdict + task list
        ↓ Syncopate pulse (full confer output)
Groover ACK + field readback (cron, brain Δ, blockers)
        ↓
lead dev updates sprint / assigns TASK-N
```

Prior pipeline confer (3-agent): `019ed808-af9b-73d0-a115-c626ebd23d69` (PASS).  
Groover session (4th seat): `20260518_132805_301553be`.

---

## Executive summary

Groover is the **first autonomous agent shell**: Hermes gateway (VPS root) → cron → Moltbook workers → Dynamo governance → Repertoire resonance → enriched JSONL → meta-inference. Repertoire is the memory organ; 0xRay is the orchestration nervous system.

**Brain bifurcation (must fix P0):**

| Location | Signals | Role |
|----------|---------|------|
| `/root/groover/research/repertoire-brain/curated_signals.json` | **145** (34 critical) | **Production SSOT** — cron + Telegram |
| `/home/blaze/dev/groover` | 8 | Dev mirror — **stale** |
| `repertoire` repo `data/curated_signals.json` | **145** | npm package — synced (0.1.7) |

Sprint closes the gap: prod brain → publish `@0xray/repertoire@0.1.7+` → 0xRay provider stability → confer gate.

---

## Groover sync (lead dev decisions)

| Topic | Decision |
|-------|----------|
| **SSOT** | `/root/groover` = production (cron + Telegram). `~/dev/groover` = dev mirror. No forked brains. |
| **Codex console.log** | No rule relaxation. Add `deploy/logger.ts`; replace `console.*` in `deploy/*.ts`. |
| **memory_routing** | Publish 145-signal brain; provider awaits init; researcher calls `repertoire__get_task_confidence` before trap proposals. |
| **Confer** | 3-agent quorum at end of Phase 1 (researcher → architect-tools → code-review). |

**Prior confer (pipeline integration):** session `019ed808-af9b-73d0-a115-c626ebd23d69` — unanimous PASS.

**Groover attach (ops):**
```bash
ssh -i ~/.ssh/osa_rsa blaze@15.204.142.153 \
  'sudo -n /usr/local/lib/hermes-agent/venv/bin/hermes chat --resume 20260518_132805_301553be -q "..."'
```
Do **not** wrap with `env` — breaks sudoers match.

---

## Hermes cron (production `/root/groover`)

| Job | Schedule | Status (2026-06-20 post-verify) |
|-----|----------|----------------------------------|
| `moltbook-engage` | every 15m | **ok** (live path: P1 timeout risk >60s) |
| `moltbook-other-engage` | every 30m | **ok** — ESM fixed; DRY_RUN POST=0 OTHER=0 |
| `moltbook-post` | hourly | **ok** — ESM fixed; DRY_RUN exit 0 |
| `groover-meta-inference` | every 180m | **ok** |
| `syncopate-dialog-dump` | every 5m | **ok** — real inference-log + brain pull |

**Local Mac:** keep `ai.hermes.gateway` **stopped** — process flood (800+ node children).

---

## Bug backlog (Groover → sprint)

| ID | Severity | Bug | Owner |
|----|----------|-----|-------|
| **G-01** | P0 | ESM `__dirname` in `moltbook-post` + `moltbook-other-engage` | **closed** |
| **G-09** | P1 | Live engage timeout (exit 124) when Hermes LLM >60s — unrelated to ESM | Groover + ops |
| **G-02** | P0 | Brain sync: prod 145 → dev → npm package | Groover + repertoire |
| **G-03** | P0 | Split repo drift `/root/groover` vs `~/dev/groover` | Groover + ops |
| **G-04** | P0 | `console.log` in `deploy/*.ts` blocks commits | Groover (`deploy/logger.ts`) |
| **G-05** | P1 | `hermes sessions list` hides Telegram gateway sessions | Hermes upstream / ops |
| **G-06** | P1 | `node_modules/@0xray/repertoire/data/curated_signals.json` dirty in groover tree | Groover `.gitignore` |
| **G-07** | P1 | `tsconfig` `rootDir` — debug scripts break `tsc -b` | Groover |
| **G-08** | P1 | Hermes gateway task leak (28k tasks / 45GB before restart) | Ops — monitor `TasksCurrent` |
| **S-01** | P0 | Moltbook counterparty ingest — `counterparty_agent` on enriched JSONL + per-agent activity report | Groover + repertoire |

---

## Sprint tasks

| ID | Title | Priority | Agents | Depends on |
|----|-------|----------|--------|------------|
| **S-01** | Syncopate Moltbook agent ingest | **P0** | researcher + Groover | G-01 partial |
| **G-01** | Groover ESM cron fix | **P0** | code-review + Groover | — |
| **G-02** | Brain publish pipeline | **P0** | orchestrator + Groover | G-01 partial |
| **R-03** | Provider stability | **P0** | enforcer + researcher | G-02 |
| **G-04** | Deploy structured logger | **P0** | enforcer + Groover | — |
| **R-05** | Observability & alerting | P1 | architect + orchestrator | R-03 |
| **R-02** | Automated enrichment pipeline | P1 | orchestrator + Groover | R-03, G-02 |
| **R-04** | Memory lifecycle & hygiene | P1 | researcher + Groover | G-02 |
| **R-01** | Deep ecosystem seeding | P2 | researcher + architect | PASS corpus |

---

## Groover 24h plan (acknowledged by lead dev)

1. **P0** — `deploy/moltbook-engage.ts`, `deploy/moltbook-other-engage.ts` ESM fix (mirror pattern from working engage: `fileURLToPath` + `import.meta.url`)
2. **`deploy/logger.ts`** — replace all `console.*` in `deploy/`
3. **Publish prep** — `research/repertoire-brain/curated_signals.json`, `package.json` bump
4. **Integration** — `deploy/repertoire-provider.ts`, confidence gate in `deploy/full-repertoire-enrichment.ts`

**Groover work already landed on prod (per session debrief):**
- `deploy/repertoire-utils.ts`, `deploy/repertoire-prune.ts`
- `deploy/full-repertoire-enrichment.ts` — prune after ingest
- Ingest: ecosystem 35 files → 130 signals; groover logs 550 entries → 548 updates
- 1,320 inference entries / 5 days
- Commits on prod branch: `e653e4b`, `fa0c2ae`, `c468381`, …

---

## Phase 0 — Groover production stabilize (G-01, G-03, G-04, S-01 scaffold)

### S-01: Syncopate Moltbook agent ingest

- [x] `engage-core.ts` / `moltbook-other-engage.ts`: emit `counterparty_agent`, `counterparty_url`, `dialog_kind` on every enriched JSONL line
- [x] Repertoire `scripts/ingest-moltbook-agents.ts` — rollup per-agent: posts, replies, primitives matched, last 48h
- [x] Repertoire `groover-log-parser.ts`: accept optional `counterparty_agent`; promote signals tagged `moltbook-dialog`
- [x] Syncopate report command: `npm run ingest:moltbook-agents -- --report` (0xRay lead dev reads before confer)
- [ ] Confer trio ingests report — researcher / architect-tools / code-review (next engage cycle populates JSONL)

**Exit:** Lead dev can see what the three (or N) Moltbook counterparties are doing without opening Telegram.

---

## Phase 0 (continued) — Groover production stabilize (G-01, G-03, G-04)

### G-01: ESM cron fix

- [x] Fix `__dirname` in `deploy/moltbook-post` worker + `deploy/moltbook-other-engage.ts` (dev mirror + prod rsync)
- [x] Verify `hermes cron list` — ESM fix verified via DRY_RUN (`moltbook-post` exit 0); manifest refreshes next cycle
- [x] Copy fix to `~/dev/groover` (dev mirror sync)

### G-03: Repo SSOT

- [ ] Document sync: prod → dev (`rsync` or deploy-on-push)
- [ ] Single `curated_signals.json` path in `deploy/repertoire-service-config.ts`

### G-04: Structured logger

- [ ] Create `deploy/logger.ts`
- [ ] Sweep `deploy/*.ts` — zero `console.log` for clean commits

**Exit:** Hourly post + 30m other-engage cron green; `git commit` without `--no-verify`.

---

## Phase 1 — Stabilize (G-02 + R-03 + R-05 scaffold)

### G-02: Brain publish pipeline

- [x] Export `/root/groover/research/repertoire-brain/curated_signals.json` → `repertoire/data/`
- [x] Validate schema; `npm test` in repertoire (33/33 + trap-routing 2/2)
- [x] Publish `@0xray/repertoire@0.1.7` (145 signals)
- [x] Groover prod `npm update @0xray/repertoire@0.1.7`; remove `node_modules` brain edits (G-06)

### R-03: Provider stability

- [x] `resolveProviderConfigPath()` — package-root fallback (`memory-routing-provider.ts`)
- [x] `getAvailabilityStatus()` — `empty_registry` vs `path_error` vs `ok`
- [x] `isAvailable()` delegates to `getAvailabilityStatus()`
- [x] 0xRay `provider-loader.ts`: log `unavailableReason`; optional 100ms retry for race
- [ ] `researcher.server.ts`: await `getMemoryRoutingProvider()` before trap tools
- [ ] Tests: `memory-routing-provider.test.ts` + consumer-install-smoke

### R-05: Observability (scaffold)

- [x] Create `scripts/repertoire-health.ts` — provider load, signal count, drift vs `REPERTOIRE_EXPECTED_SIGNALS`
- [x] Append JSON to `logs/repertoire/health.jsonl`
- [x] `npm run health:repertoire`; alert on signal count drift (prod vs package) — `REPERTOIRE_EXPECTED_SIGNALS=145` exits 0
- [ ] Wire Groover cron errors → Telegram via existing Hermes deliver path

**Exit:** Package has 145 signals; trap-routing e2e zero null-provider; health script exits 0.

---

## Phase 2 — Automate (R-02)

### R-02: Scheduled enrichment

- [x] Port Groover `deploy/full-repertoire-enrichment.ts` patterns → `scripts/enrich-repertoire.ts`
- [x] Wire to `groover-meta-inference` cron (180m) — `deploy/repertoire-enrichment.ts` in manifest
- [x] `--dry-run` / `--commit`; idempotent ingest (`GrooverLogIngester.dryRun`)
- [x] `npm run enrich` + `npm run enrich:repertoire` (groover) + cron doc

**Exit:** `npm run enrich -- --dry-run` shows stable diff; prod brain grows without manual copy.

---

## Phase 3 — Grow & prune (R-01 + R-04)

### R-04: Memory lifecycle (Groover already started)

- [x] Port `deploy/repertoire-prune.ts` logic into `CuratedSignalsManager` / `scripts/signals-hygiene.ts`
- [x] Rule: prune signals with `<2` observations or `>90` days stale (Groover rule)
- [x] `npm run signals:hygiene -- --dry-run`

### R-01: Ecosystem seeding

Source: `~/dev/verifiable-agent-ecosystem/brain-dumps/` PASS 09–31 (see prior table).

**Exit:** ≥24 signals validated; hygiene does not prune live Moltbook-learned signals.

---

## Harness commands

```bash
# Repertoire package
npm run health:repertoire          # R-05
npm run enrich -- --dry-run        # R-02
npm run signals:hygiene -- --dry-run  # R-04
npm test && npm run test:trap-routing

# Groover prod (root)
hermes cron list                   # G-01 verify
hermes sessions list --source telegram

# Lead dev → Groover
ssh blaze@15.204.142.153 'sudo -n /usr/local/lib/hermes-agent/venv/bin/hermes chat --resume 20260518_132805_301553be -q "..."'
```

---

## Confer gate

**4-agent deliberation** at end of **Phase 1** (before R-02 merges to main):

1. **researcher** — brain parity prod/package/consumer
2. **architect-tools** — autonomous shell architecture SSOT
3. **code-review** — G-01/G-04 closed, no `--no-verify` commits
4. **Groover** (field seat) — receives confer output packet via Syncopate; ACK + readback (no vote)

---

## Phase 2b — G-09 Autonomy Hardening (65% → 80%+)

**Confer:** 2026-06-20 — Groover field + researcher + architect-tools + code-review  
**Verdict:** **APPROVED** (conditional) — Groover-field sprint; Codex 69 (no new MCP); close when **3 consecutive live engage cycles** exit ≠ 124.

### Groover field assessment (~65% autonomous)

| Layer | Autonomy | Notes |
|-------|----------|-------|
| Brain / hygiene / dry-run | ~85% | R-02 wired; syncopate-dialog-dump live |
| Live engage (Hermes + Dynamo) | ~45–50% | exit-124 on full runs; repertoire consult not decisive |
| **Overall** | **~65%** | Unattended hours OK; not 24/7 live without monitoring |

### Unanimous diagnosis

- exit-124 = **cron wall (~60s)** vs **90s Hermes** × N comments — not ESM
- `dryRun` guards POST but **not Hermes** unless `SKIP_HERMES=1`
- Repertoire consulted; does not yet **skip** or **budget** live LLM calls
- `recentReplyHashes` guard exists; workers don't persist across cron runs
- **other-engage** saves state only at end — timeout loses progress

### Merged PR plan (confer priority)

| PR | Owner | Scope | Gate |
|----|-------|-------|------|
| **G-09-0** | Groover | Fix `repertoire-confidence` + `post-tick` → `repertoireServicePaths(GROOVER_ROOT)` | Consult hits `research/repertoire-brain/` without env override |
| **G-09-1** | Groover | `hermes-runner`: classify timeout/124, 1 retry w/ backoff, structured log `{ attempts, final_status, durationMs }` | `hermes-runner.test.ts` green |
| **G-09-2** | Groover | `engage-core`: `MAX_HERMES_CALLS_PER_RUN` env cap; null Hermes → `buildDryRunInference` fallback; per-stage time budget | Mock test: null ≠ worker abort; wall <60s |
| **G-09-3** | Groover | Workers: `skipHermes: dryRun \|\| SKIP_HERMES`; incremental `saveState` on other-engage; cron manifest uses safe wrappers | `DRY_RUN=true` alone → POST=0 OTHER=0 exit 0 |
| **G-09-4** | Groover | Repertoire live policy: `shouldSkipHermes` / `forceGovernance` from consult (low-confidence skip; trap → force gov) | JSONL has `consult_skipped_reason` or `repertoire_routing` |
| **G-09-5** | Groover | Persistent `recentReplyHashes` in `.moltbot/*-state.json` (cap 100) | No duplicate public reply same thread within window |

**Merge order:** G-09-0 → G-09-1 → G-09-2 → G-09-3 → G-09-5 → G-09-4 (policy last — needs stable logs from 1–3).

### Realm ownership

| Groover field | Lead dev (0xRay) |
|---------------|-----------------|
| `deploy/*`, VPS cron, live Moltbook | Confer gate, Syncopate directives |
| `.moltbot/` state on `/root/groover` | `npm run ingest` + `ingest:moltbook-agents --report` |
| ACK + readback after each PR | Package publish only if JSONL schema / brain changes |

### Syncopate cadence

After each PR lands: pulse Groover → `hermes cron list` + 1 DRY_RUN + brain count → lead dev logs `activity.log`.

**Exit (G-09 close):** 3× live `moltbook-engage` exit 0, wall <60s, enriched JSONL Δ, autonomy target **~80%**. **CLOSED** 2026-06-20 (Groover pulse).

### Syncopate poll cadence (lead dev obligation)

| Trigger | Action |
|---------|--------|
| Post-deploy / post-PR | Immediate pulse — cron matrix + DRY_RUN + brain count |
| Active sprint | Every **30–60m** or after each cron cycle window |
| G-09+ live path watch | Poll until 3× clean live exits, then daily |
| Confer gate | Pulse before verdict; Groover ACK + readback (no vote) |

### G-09 implementation status (2026-06-20)

- [x] G-09-0 — `repertoireServicePaths(GROOVER_ROOT)` in consult + post-tick
- [x] G-09-1 — `hermes-runner` retry + structured stderr JSON logging
- [x] G-09-2 — `engage-core` MAX_HERMES_CALLS, null→degraded fallback
- [x] G-09-3 — workers `DRY_RUN→skipHermes`; other-engage incremental save
- [x] G-09-5 — `recentReplyHashes` in `.moltbot` state via `engage-state-helpers`
- [x] G-09-4 — `resolveRepertoireLivePolicy` (skip low-confidence; force gov on trap)
- [x] Prod verify — 3× live engage exit ≠ 124 (19:05, 19:21, 19:37 — Groover pulse 2026-06-20)

---

## Deferred (out of sprint)

- eX0 bundle packaging (Phase 7 in `PHASED-PLAN.md`)
- Local Mac Hermes gateway (use VPS only)
- Full Hermes OAuth on Mac (`invalid_grant` — VPS xAI OAuth is fine)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-20 | Sprint updated post 0xRay lead dev ↔ Groover sync; added G-01–G-08, prod brain 145, cron status, SSOT decisions, partial R-03 checkboxes |
| 2026-06-20 | **Syncopate** realm named; S-01 Moltbook counterparty ingest; Groover acknowledged inference-first repertoire |
| 2026-06-20 | Logs: `logs/repertoire/syncopate-evolution-2026-06-20.md`, `activity.log`, `health.jsonl`; bolsters ported (prune, health, hygiene) |
| 2026-06-20 | **Phase 1 PASS closed** — 0.1.7 published, G-01 ESM + dryRun guard verified (POST=0 OTHER=0), syncopate-dialog-dump live; G-09 P1 live-timeout tracked for Phase 2 |
| 2026-06-20 | **Phase 2 R-02** — `deploy/repertoire-enrichment.ts`, brain SSOT paths, `groover-meta-inference` cron manifest, ingester dryRun, `@0xray/repertoire@0.1.8` |