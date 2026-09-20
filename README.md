# @0xray/repertoire

Factory memory organ for [0xRay](https://github.com/0xRayAI/xray): seed primitives, in-process memory routing, extra MCP (not an 8th `xray-*` server).

**v0.2.1** · 0xRay **4.0** wear. Runtime does **not** depend on `0xray` (optional peer for suit-verify scripts).

## Install

```bash
npm install @0xray/repertoire
```

Does not install `0xray`. After 0xray wear, refresh Grok hooks:

```bash
npx 0xray grok install --force
```

Restart Grok MCP sessions — hooks do not hot-reload.

## Suit + autonomy (Grok Build)

```bash
npm run confirm:suit    # post-reboot: Layer 1 + 2a + 2b checklist
```

**Suit verify from any consumer** (project must have `.xray/` + `0xray` installed):

```bash
npx repertoire-verify-suit    # 30-check harness from any consumer project root
```

Includes 3.5.0 delegation gate + PostToolUse assertions (steps 11–13). Full harness: clone this repo and `npm run confirm:suit`. Quick check: `npx 0xray health`.

Default operating model: **`autonomy-command`** — lead dev, phased todos, subagent dispatch, per-suite test triage. See [AGENTS.md](AGENTS.md) and [xray autonomy guide](https://0xrayai.github.io/xray/docs/guides/autonomy-command).

## MCP server (Hermes, Grok, OpenCode)

```json
"repertoire": {
  "command": "npx",
  "args": ["-y", "@0xray/repertoire", "mcp"]
}
```

Bundled `data/curated_signals.json` is **read-only**. The provider hydrates a project copy under `.xray/state/repertoire/curated_signals.json` — including when cwd is this organ repo. Feedback never writes the tarball seed.

Override with env:

| Env | Default |
|-----|---------|
| `CURATED_SIGNALS_PATH` | factory seed (hydrated to `.xray/state/repertoire/curated_signals.json`) |
| `REPERTOIRE_DATA_DIR` | `.xray/state/repertoire` |
| `REPERTOIRE_STATE_PATH` | `.xray/state/repertoire/inference-state.json` |
| `REPERTOIRE_LOG_DIR` | `.xray/state/repertoire/logs` |
| `REPERTOIRE_FEEDBACK_DIR` | `.xray/state/repertoire/feedback` |

### Tools

| Tool | Purpose |
|------|---------|
| `repertoire__get_task_confidence` | Trap detection, complexity boost, `recommendedAgent` |
| `repertoire__search_primitives` | Text search against curated signals |
| `repertoire__get_high_confidence_signals` | Validated signals above threshold |
| `repertoire__ingest_feedback` | Record orchestrator outcomes |

Routing confidence is **time-weighted**: excess above the 0.55 gate fades after a 14-day grace (60-day half-life). Factory seed sitting on the gate keeps routing. `npm run signals:hygiene` reports decay on the hydrated project copy under `.xray/state/repertoire/`; it dry-runs in this repo unless `--i-mean-it` (writes the project copy, never the tarball).

## 0xRay memory routing (in-process)

In `.xray/features.json` or `xray/features.json`:

```json
"memory_routing": {
  "enabled": true,
  "provider": "repertoire",
  "module_path": "node_modules/@0xray/repertoire/dist/provider/memory-routing-provider.js"
}
```

`config` is optional when using the bundled registry. For a project-local registry:

```json
"config": {
  "signalsPath": ".xray/state/repertoire/curated_signals.json",
  "statePath": ".xray/state/repertoire/inference-state.json",
  "feedbackDir": ".xray/state/repertoire/feedback",
  "logDir": ".xray/state/repertoire/logs"
}
```

Paths in `config` resolve relative to the consumer project root.

## Programmatic import

```ts
import { createMemoryRoutingProvider } from '@0xray/repertoire/provider/memory-routing-provider';

const provider = createMemoryRoutingProvider();
provider.getTaskConfidence?.({
  id: 'task-1',
  description: 'TYPE: ontological-trap attestation-as-map',
  type: 'governance',
});
```

## Field actuation add-ons (optional)

Repertoire has **no Moltbook dependency**. It ingests **enriched JSONL** from any producer (`matched_primitives` + `match_confidence`) and closes the memory loop via consult, feedback, and post-tick ingest.

Each project activates its own public field surface if it wants one:

| Layer | Required? | Example |
|-------|-----------|---------|
| Repertoire + 0xRay memory routing | Core suit | `npm install @0xray/repertoire`, `features.json` |
| Engage pipeline (`consult → govern → log`) | Per producer | `groover/deploy/engage-core.ts` |
| Moltbook (or other social API) | **Add-on** | Groover's `deploy/moltbook-*.ts` + `MOLTBOOK_API_KEY` |

Jelly, ZigZag, or a custom cron worker can wire the same loop without Moltbook — point `logDir` at your JSONL and set `REPERTOIRE_ROOT`.

## Sibling-repo development

```bash
git clone https://github.com/0xRayAI/repertoire
cd repertoire && npm install && npm run build && npm test
```

See [AGENTS.md](./AGENTS.md) for stack integration details.