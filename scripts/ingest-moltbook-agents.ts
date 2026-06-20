#!/usr/bin/env node
/**
 * S-01: Per-agent Moltbook counterparty rollup from enriched JSONL.
 */
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_LOG_DIR } from '../src/paths.js';

interface AgentRollup {
  counterparty_agent: string;
  counterparty_url: string;
  posts_engaged: number;
  replies_inferred: number;
  dialog_kinds: string[];
  primitives_matched: Record<string, number>;
  last_seen: string;
}

const args = process.argv.slice(2);
const reportOnly = args.includes('--report');
const hoursIdx = args.indexOf('--hours');
const windowHours = hoursIdx >= 0 ? Number(args[hoursIdx + 1]) : 48;
const pathIdx = args.indexOf('--path');
const logDir = pathIdx >= 0 ? args[pathIdx + 1]! : DEFAULT_LOG_DIR;

const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
const agents = new Map<string, AgentRollup>();

function bumpAgent(raw: Record<string, unknown>): void {
  const agent = String(raw.counterparty_agent ?? 'unknown');
  const url = String(raw.counterparty_url ?? '');
  const kind = String(raw.dialog_kind ?? 'engage');
  const ts = String(raw.timestamp ?? new Date().toISOString());
  if (new Date(ts).getTime() < cutoff) return;

  let row = agents.get(agent);
  if (!row) {
    row = {
      counterparty_agent: agent,
      counterparty_url: url,
      posts_engaged: 0,
      replies_inferred: 0,
      dialog_kinds: [],
      primitives_matched: {},
      last_seen: ts,
    };
    agents.set(agent, row);
  }

  row.replies_inferred += 1;
  if (!row.dialog_kinds.includes(kind)) row.dialog_kinds.push(kind);
  if (raw.post_id) row.posts_engaged += 1;
  if (ts > row.last_seen) row.last_seen = ts;

  const primitives = raw.matched_primitives;
  if (Array.isArray(primitives)) {
    for (const p of primitives) {
      if (typeof p === 'string') {
        row.primitives_matched[p] = (row.primitives_matched[p] ?? 0) + 1;
      }
    }
  }
}

if (!existsSync(logDir)) {
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), counterparties: [] }, null, 2));
  process.exit(0);
}

for (const file of readdirSync(logDir).filter((f) => f.endsWith('.jsonl'))) {
  for (const line of readFileSync(join(logDir, file), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      if (raw.counterparty_agent) bumpAgent(raw);
    } catch {
      // skip
    }
  }
}

const output = {
  generated_at: new Date().toISOString(),
  window_hours: windowHours,
  counterparties: [...agents.values()].sort((a, b) => b.replies_inferred - a.replies_inferred),
};

const outDir = join('logs', 'repertoire');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `moltbook-agents-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(JSON.stringify(output, null, 2));

if (reportOnly && output.counterparties.length === 0) {
  process.exit(0);
}