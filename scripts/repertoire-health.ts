#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryRoutingProvider } from '../src/provider/memory-routing-provider.js';
import {
  DEFAULT_SIGNALS_PATH,
  DEFAULT_LOG_DIR,
  DEFAULT_STATE_PATH,
} from '../src/paths.js';

interface HealthSnapshot {
  timestamp: string;
  signals_path: string;
  signal_count: number;
  provider_available: boolean;
  provider_reason: string;
  enriched_log_files: number;
  enriched_log_lines: number;
  inference_state_ids: number;
  drift_warning: string | null;
  expected_prod_signals: number | null;
}

function countJsonlLines(dir: string): { files: number; lines: number } {
  if (!existsSync(dir)) return { files: 0, lines: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  let lines = 0;
  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf8').trim();
    if (content) lines += content.split('\n').length;
  }
  return { files: files.length, lines };
}

function countInferenceState(path: string): number {
  if (!existsSync(path)) return 0;
  const state = JSON.parse(readFileSync(path, 'utf8')) as {
    processedCommentIds?: string[];
    processedPostIds?: string[];
  };
  return (
    (state.processedCommentIds?.length ?? 0) + (state.processedPostIds?.length ?? 0)
  );
}

const prodExpected = process.env.REPERTOIRE_EXPECTED_SIGNALS
  ? Number(process.env.REPERTOIRE_EXPECTED_SIGNALS)
  : null;

const provider = createMemoryRoutingProvider();
const status = (
  provider as {
    getAvailabilityStatus(): {
      available: boolean;
      reason: string;
      signalCount: number;
      signalsPath: string;
    };
  }
).getAvailabilityStatus();

const logs = countJsonlLines(DEFAULT_LOG_DIR);
let drift: string | null = null;
if (prodExpected !== null && status.signalCount !== prodExpected) {
  drift = `signal_count ${status.signalCount} !== expected prod ${prodExpected}`;
}

const snapshot: HealthSnapshot = {
  timestamp: new Date().toISOString(),
  signals_path: status.signalsPath || DEFAULT_SIGNALS_PATH,
  signal_count: status.signalCount,
  provider_available: status.available,
  provider_reason: status.reason,
  enriched_log_files: logs.files,
  enriched_log_lines: logs.lines,
  inference_state_ids: countInferenceState(DEFAULT_STATE_PATH),
  drift_warning: drift,
  expected_prod_signals: prodExpected,
};

const outDir = join('logs', 'repertoire');
mkdirSync(outDir, { recursive: true });
appendFileSync(join(outDir, 'health.jsonl'), `${JSON.stringify(snapshot)}\n`);

console.log(JSON.stringify(snapshot, null, 2));

if (!status.available || drift) {
  process.exit(1);
}