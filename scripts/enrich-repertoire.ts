#!/usr/bin/env node
/**
 * R-02: Scheduled enrichment wrapper — ingest JSONL → optional meta-inference → signal diff.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RepertoireService } from '../src/RepertoireService.js';
import { CuratedSignalsManager } from '../src/registry/CuratedSignalsManager.js';
import { DEFAULT_LOG_DIR, DEFAULT_SIGNALS_PATH } from '../src/paths.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const commit = args.includes('--commit');
const sourceIdx = args.indexOf('--path');
const sourceDir = sourceIdx >= 0 ? args[sourceIdx + 1]! : DEFAULT_LOG_DIR;

if (!dryRun && !commit) {
  console.error('Usage: npm run enrich -- --dry-run|--commit [--path <jsonl-dir>]');
  process.exit(1);
}

const manager = new CuratedSignalsManager(DEFAULT_SIGNALS_PATH);
const before = manager.load();
const beforeNames = new Set(before.signals.map((s) => s.name));

const service = new RepertoireService({ signalsPath: DEFAULT_SIGNALS_PATH });
const ingest = service.ingestGrooverLogs(sourceDir);

const after = manager.load();
const added = after.signals.filter((s) => !beforeNames.has(s.name)).map((s) => s.name);
const promoted = ingest.promoted;

const report = {
  timestamp: new Date().toISOString(),
  dry_run: dryRun,
  source_dir: sourceDir,
  imported: ingest.imported,
  skipped: ingest.skipped,
  promoted,
  new_signal_names: added,
  signal_count: after.signals.length,
};

const outDir = join('logs', 'repertoire');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `enrich-${dryRun ? 'dry' : 'commit'}-${Date.now()}.json`);
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));

if (dryRun) {
  console.error('Dry-run: no signal file mutations beyond ingest promotion path.');
}