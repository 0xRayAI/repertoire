# Consolidated Roadmap — Overarching View

**Date:** 2026-06-20  
**Purpose:** Single helm document mapping every active plan; ends roadmap fragmentation.  
**Audience:** Lead dev + you — executive summaries derive from here.

---

## Why this exists

At least **12 plans** were running in parallel with overlapping names (“P0”, “aside”, “suit”, “pipeline”, “Jelly”). They use different repos, branches, and exit gates. This doc is the **index + priority stack**. Detail stays in source docs; **helm order lives here only**.

---

## Helm stack (do in this order)

```text
TIER 0 — SHIPPED (maintain, do not re-sprint)
  Core field loop · suit wearable · Repertoire memory · Groover G-09

TIER 1 — IN FLIGHT (unblock everything else)
  1. Merge feat/user-asides → xray main + npm tag (3.5.5) — **code ready**
  2. ~~User-asides P0~~ — **done** 2026-06-20 (cwd deny + auto_provision_worktree)
  3. ~~Pipeline P3 skeleton~~ — **done** (`verify:pipeline-facets`, `confirm:suit:full`)

TIER 2 — PLATFORM COMMERCIAL (after Tier 1 tag)
  Jelly J1–J7 (strray-ai → 0xray, Dynamo gate, tenant e2e)

TIER 3 — DEFERRED
  ZigZag Z1–Z8 · Phase B–D correlation bus · eX0 bundle · suit-nft mint · verbose maturation tail
```

---

## Reality snapshot (2026-06-20)

| Repo | Branch | HEAD | npm / pin | Role |
|------|--------|------|-----------|------|
| `xray` | `main` | `327c618bd` | **0xray@3.5.5** (npm tag pending) | User-asides P0 + pipeline P3 — confer CONDITIONAL PASS |
| `repertoire` | `main` | `6b2848a` | **@0xray/repertoire@0.1.8** | Memory organ + MCP + consolidated helm |
| `groover` | `main` | `97027aa` | 0xray ^3.4.x prod | Field body (Moltbook VPS) |
| `repertoire-suit-iteration` | `feat/suit-pre-release-iteration` | `a27db28` | links `file:../xray` | Suit dogfood worktree — **complete** |
| `jelly` | varies | — | **strray-ai 1.18** ❌ | Commercial — blocked on J1 |
| `0x0` | private | — | SSOT docs | Platform helm (often stale vs branches) |

**Prod field:** brain **145** signals · crons ok · G-09 closed · Syncopate poll **daily** (not sprint cadence).

---

## Document registry (every roadmap, one line)

### Platform SSOT (`~/dev/0x0` — TOP SECRET)

| Doc | Scope | Status |
|-----|-------|--------|
| [`0x0/docs/FINAL-PLAN.md`](../../0x0/docs/FINAL-PLAN.md) | Claimed single entry; P0 complete, Jelly J1 next | **Stale** — says repertoire 0.1.1, xray 3.4.8; missing user-asides branch |
| [`0x0/docs/ROADMAP.md`](../../0x0/docs/ROADMAP.md) | Phases 0–D master checklist | **Active** — Phase A mostly ✅; Jelly J1–J7 open |
| [`0x0/docs/MVP-NOW.md`](../../0x0/docs/MVP-NOW.md) | Rock-solid MVP filter | **Active** — Jelly Tier 1 = commercial spine |
| [`0x0/docs/CORE-UNIFORMITY-PLAN.md`](../../0x0/docs/CORE-UNIFORMITY-PLAN.md) | P0 trio contract | **COMPLETE** ✅ 2026-06-19 |
| [`0x0/docs/CORE-STRENGTHENING-PLAN.md`](../../0x0/docs/CORE-STRENGTHENING-PLAN.md) | Iteration 2 shoring | Historical — landed in groover/repertoire |
| [`0x0/docs/GROK-BUILD-SUIT-WEAR.md`](../../0x0/docs/GROK-BUILD-SUIT-WEAR.md) | P0.0 suit in Grok Build | **COMPLETE** |
| [`0x0/docs/asides/JELLY-0XRAY-MIGRATION-PLAN.md`](../../0x0/docs/asides/JELLY-0XRAY-MIGRATION-PLAN.md) | Jelly J1 migration | **Not started** — Tier 2 |

### Repertoire (`~/dev/repertoire`)

| Doc | Scope | Status |
|-----|-------|--------|
| [`PHASED-PLAN.md`](./PHASED-PLAN.md) | Phases 1–7 integration | **1–6 ✅** · Phase 7 eX0 **deferred** |
| [`REPERTOIRE-MATURATION-SPRINT.md`](./REPERTOIRE-MATURATION-SPRINT.md) | Aside: Groover ↔ Repertoire Syncopate | **CLOSED** ✅ G-09 2026-06-20 |
| [`reflections/repertoire-maturation-aside-close-reflection-2026-06-20.md`](./reflections/repertoire-maturation-aside-close-reflection-2026-06-20.md) | Aside close narrative | Done — ritual for aside closure |
| **This file** | Overarching consolidation | **Living SSOT for helm order** |

### Suit iteration worktree (`~/dev/repertoire-suit-iteration`)

| Doc | Scope | Status |
|-----|-------|--------|
| [`SUIT-PRE-RELEASE-ROADMAP.md`](../../repertoire-suit-iteration/docs/SUIT-PRE-RELEASE-ROADMAP.md) | Session 019ed808 suit dogfood | **COMPLETE** ✅ |
| [`SUIT-OPERATIONAL-ROADMAP.md`](../../repertoire-suit-iteration/docs/SUIT-OPERATIONAL-ROADMAP.md) | 4-bridge wear matrix | Sprint 2 fixes **done** |
| [`PIPELINE-INTEGRATION-MASTER-PLAN.md`](../../repertoire-suit-iteration/docs/PIPELINE-INTEGRATION-MASTER-PLAN.md) | P0–P3 pipeline facets | **P0–P2 mostly on branch** · **P3 open** |
| [`PIPELINE-FACET-MASTER-INVENTORY.md`](../../repertoire-suit-iteration/docs/PIPELINE-FACET-MASTER-INVENTORY.md) | 70 facet audit | Reference — 15 LIVE, 23 PARTIAL, 32 DORMANT |
| [`reflections/suit-operational-sprint2-complete-2026-06-20.md`](../../repertoire-suit-iteration/docs/reflections/suit-operational-sprint2-complete-2026-06-20.md) | Sprint 2 close | Done |

### 0xRay framework (`~/dev/xray` — branch `feat/user-asides`)

| Doc | Scope | Status |
|-----|-------|--------|
| [`docs-site/docs/guides/user-asides-roadmap.md`](../../xray/docs-site/docs/guides/user-asides-roadmap.md) | User-asides engineering backlog | **P0 open** (2 items) |
| [`docs-site/docs/guides/parallel-work-tracks.md`](../../xray/docs-site/docs/guides/parallel-work-tracks.md) | Consumer guide + suit-nft **example** | Shipped on branch |
| [`docs-site/docs/guides/user-asides.md`](../../xray/docs-site/docs/guides/user-asides.md) | MCP/state reference | Shipped; limitations documented |
| [`docs/reflections/user-asides-review-quorum-2026-06-20.md`](../../xray/docs/reflections/user-asides-review-quorum-2026-06-20.md) | 3-agent ship review | **PASS** round 4 |
| [`docs/reflections/user-asides-roadmap-quorum-2026-06-20.md`](../../xray/docs/reflections/user-asides-roadmap-quorum-2026-06-20.md) | Enforcement vs awareness reprioritization | Applied to roadmap |

### Not roadmaps (do not confuse)

| Item | What it is |
|------|------------|
| `suit-nft` | **Docs example only** — no `asides/suit-nft.json` on disk |
| `repertoire-maturation` | **Closed aside** — tracked in sprint doc, not `asides/*.json` |
| AsideContext (`spawnAside`) | Internal orchestrator MCP — not user aside |
| `xray-v3` / `stringray` TEST_ENABLEMENT_ROADMAP | Legacy fork docs — ignore for helm |

---

## Track status (merged view)

### TIER 0 — Complete (maintain only)

| Track | Exit gate | Maintenance |
|-------|-----------|-------------|
| **Core uniformity (P0)** | Live Moltbook loop A4.3, trio contract | Don't re-litigate |
| **Suit wearable** | `confirm:suit:all` 5/5, 4/4 bridges | Re-run on consumer bump |
| **Repertoire phases 1–6** | npm, MCP, trap-routing, CI | Publish when brain > 145 |
| **Maturation aside** | G-09, brain 145, 0.1.8 | Daily Groover Syncopate poll |
| **Groover field** | Crons ok, autonomy ~80% | Skip G-04/R-01/R-04 unless regression |

### TIER 1 — In flight (current engineering)

| # | Work | Source plan | Repo/branch | Open items |
|---|------|-------------|-------------|------------|
| **1.1** | **User-asides P0** — cwd deny on spawn | user-asides-roadmap | `xray/feat/user-asides` | worktree enforcement, auto-provision |
| **1.2** | **Pipeline P3** — facet audit harness | PIPELINE-INTEGRATION-MASTER-PLAN | `xray/feat/user-asides` | `verify:pipeline-facets`, `confirm:suit:full` |
| **1.3** | **Ship branch** — merge + tag | SUIT-PRE-RELEASE exit | `xray` → `main`, npm **3.5.5** | release-gate, CHANGELOG, Docusaurus |
| **1.4** | **User-asides P1** (after ship) | user-asides-roadmap | xray | session-boot summaries, `_active` sessionId, resume ritual, archive lifecycle |
| **1.5** | **Sync 0x0 FINAL-PLAN** | This consolidation | `0x0/docs` | Bump versions, add feat/user-asides + pipeline P3 state |

**Pipeline P0–P2 on branch (`7ef5b7547`):** governance wire, hook runtime, SelfProposal, confer emojis — **landed, not same as “plan complete”** until P3 audit exists.

### TIER 2 — Jelly commercial (platform P1)

| # | Work | Source | Status |
|---|------|--------|--------|
| J1 | `strray-ai` → `0xray@3.5.x` | MVP-NOW Tier 1 #1, ROADMAP J1 | **Blocked** until xray branch merges/tags |
| J2 | Dynamo before sandbox spawn | MVP-NOW #2 | Open |
| J3 | `.xray/` + memory_routing in Jelly | MVP-NOW #3 | Open |
| J4 | ingestFeedback from tenant actions | MVP-NOW #4 | Open |
| J5 | One e2e tenant path | MVP-NOW #5 | Open |
| J6 | `DYNAMO_STRICT` commercial | MVP-NOW #6 | Open |
| J7 | LICENSE hygiene | MVP-NOW #7 | Open |

### TIER 3 — Deferred (explicitly not now)

| Track | Source | Trigger to reopen |
|-------|--------|-------------------|
| **ZigZag Z1–Z8** | ROADMAP Phase D, MVP-NOW future | After Jelly MVP |
| **Phase B–D** (correlation bus, registry key) | 0x0 ROADMAP | Post-Jelly |
| **Repertoire Phase 7** (eX0 bundle) | PHASED-PLAN | After live loop stable in product |
| **suit-nft mint aside** | parallel-work-tracks example | User intake + P0 cwd |
| **Maturation verbose tail** | REPERTOIRE-MATURATION-SPRINT | Field regression only (G-04, R-04, R-01…) |
| **MintNFT / CAT721** | 0x0 local-repos Tier 6 | Phase D or explicit aside |
| **Meta-inference cron (Mac OAuth)** | PHASED-PLAN | Optional; VPS path works |

---

## Three-layer model (stops conflation)

```text
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM (0x0 ROADMAP / MVP-NOW / FINAL-PLAN)            │
│  Jelly → ZigZag → correlation bus → identity/value        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  FRAMEWORK (xray feat/user-asides + pipeline plan)          │
│  Parallel work tracks · hooks · governance pipeline facets  │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  FIELD + MEMORY (groover main + repertoire main)            │
│  Moltbook crons · brain 145 · Syncopate · npm 0.1.8         │
└─────────────────────────────────────────────────────────────┘
```

**Session `019ed808`** spanned framework + suit worktrees. **Maturation aside** was field-layer parallel work, now closed. **Jelly** is platform-layer — different timescale.

---

## What “complete” means (disambiguation)

| Phrase | Means | Complete? |
|--------|-------|-----------|
| “P0 complete” (0x0) | Core trio + live field loop | **Yes** ✅ |
| “Suit pre-release complete” | Worktree dogfood session 019ed808 | **Yes** ✅ |
| “User-asides PASS” | Ship review on branch | **Yes** on branch — **not on npm/main** |
| “Pipeline alignment complete” | Full PIPELINE-INTEGRATION-MASTER-PLAN | **No** — P3 open |
| “Maturation aside closed” | G-09 exit | **Yes** ✅ |
| “Jelly unblocked” | FINAL-PLAN | **Partially** — needs xray merge/tag first |
| “suit-nft aside” | NFT mint parallel track | **Never started** — example only |

---

## Single next-action list (copy to lead-dev plan)

1. ~~User-asides P0 + P3 + merge~~ — **done** `327c618bd` / `6b2848a`; retrospective confer **CONDITIONAL PASS** 2026-06-20
2. **`npm publish 0xray@3.5.5`** — after `release-gate`; Groover ACK: no field blockers
3. **3.5.6 hardening** — `auto_chain_delegations: false` cwd bypass; synthesis+worktree deny test
4. **Kick Jelly J1** — after npm tag
5. **Background:** Groover Syncopate daily poll; publish repertoire if brain > 145

---

## Rituals (going forward)

| Event | Artifact |
|-------|----------|
| Aside closes | Deep reflection in `docs/reflections/` |
| Tier 1 item ships | Update **this file** + source roadmap checkbox |
| npm tag | Sync `0x0/FINAL-PLAN` version table |
| New parallel track | Intake via `analyze-complexity` → `asides/{id}.json` (not doc-only) |

**Rule:** One **active engineering tier** at a time. Tier 0 = maintenance. Don't open Jelly J1 while `feat/user-asides` is unmerged.

---

## Related links

| Need | Go to |
|------|-------|
| Platform phases A–D | `0x0/docs/ROADMAP.md` |
| MVP filter | `0x0/docs/MVP-NOW.md` |
| Repertoire integration history | `docs/PHASED-PLAN.md` |
| Closed field sprint | `docs/REPERTOIRE-MATURATION-SPRINT.md` |
| Framework gaps | `xray/docs-site/docs/guides/user-asides-roadmap.md` |
| Pipeline facet detail | `repertoire-suit-iteration/docs/PIPELINE-INTEGRATION-MASTER-PLAN.md` |

---

*Last consolidated: 2026-06-20. Supersedes conflicting helm statements in conversation; does not delete source roadmaps.*