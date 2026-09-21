#!/usr/bin/env node
/**
 * R-02: Scheduled enrichment — ingest JSONL → meta-inference → hygiene prune.
 */
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { RepertoireService } from '../src/RepertoireService.js';
import { CuratedSignalsManager } from '../src/registry/CuratedSignalsManager.js';
import { GrooverLogIngester } from '../src/ingestion/groover-log-ingester.js';
import { pruneSignals } from '../src/registry/signal-prune.js';
import {
  DEFAULT_SIGNALS_PATH,
  defaultWritablePaths,
  discoverFieldLogDirs,
  hydrateWritableSignals,
} from '../src/paths.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const commit = args.includes('--commit');
const skipMeta = args.includes('--skip-meta-inference');
const skipPrune = args.includes('--skip-prune');
const sourceIdx = args.indexOf('--path');
const discovered = discoverFieldLogDirs();
const sourceDir =
  sourceIdx >= 0 ? args[sourceIdx + 1]! : (discovered[0] ?? defaultWritablePaths().logDir);

if (!dryRun && !commit) {
  process.stderr.write(
    'Usage: npm run enrich -- --dry-run|--commit [--path <jsonl-dir>] [--skip-meta-inference] [--skip-prune]\n',
  );
  process.exit(1);
}

const signalsPath = hydrateWritableSignals(DEFAULT_SIGNALS_PATH);
const manager = new CuratedSignalsManager(signalsPath);
const before = manager.load();
const beforeNames = new Set(before.signals.map((s) => s.name));
const beforeCount = before.signals.length;

const writable = defaultWritablePaths();
const service = new RepertoireService({ signalsPath, syncField: false });
const ingester = new GrooverLogIngester({
  sourceDir,
  targetDir: writable.logDir,
  signalsManager: manager,
  stateManager: service.stateManager,
  dryRun,
});
const ingest = ingester.ingest();

const after = manager.load();
const added = after.signals.filter((s) => !beforeNames.has(s.name)).map((s) => s.name);

let metaInference: {
  entriesProcessed: number;
  dynamoPass: number;
  dynamoReject: number;
} | null = null;

if (commit && !dryRun && !skipMeta) {
  const report = await service.runMetaInference();
  if (report) {
    metaInference = {
      entriesProcessed: report.entriesProcessed,
      dynamoPass: report.dynamoStats.pass,
      dynamoReject: report.dynamoStats.reject,
    };
  }
}

const pruneResult = skipPrune
  ? null
  : pruneSignals(manager, { dryRun });

const report = {
  timestamp: new Date().toISOString(),
  mode: dryRun ? 'dry-run' : 'commit',
  source_dir: sourceDir,
  imported: ingest.imported,
  skipped: ingest.skipped,
  promoted: ingest.promoted,
  new_signal_names: added,
  signal_count_before: beforeCount,
  signal_count_after: manager.load().signals.length,
  meta_inference: metaInference,
  prune_removed: pruneResult?.removed.length ?? 0,
  prune_kept: pruneResult?.kept ?? null,
};

const outDir = join('logs', 'repertoire');
mkdirSync(outDir, { recursive: true });
const stamp = Date.now();
writeFileSync(join(outDir, `enrich-${dryRun ? 'dry' : 'commit'}-${stamp}.json`), JSON.stringify(report, null, 2));
appendFileSync(join(outDir, 'enrich.jsonl'), `${JSON.stringify(report)}\n`);

console.log(JSON.stringify(report, null, 2));