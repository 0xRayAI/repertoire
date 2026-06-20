#!/usr/bin/env node
import { CuratedSignalsManager } from '../src/registry/CuratedSignalsManager.js';
import { pruneSignals } from '../src/registry/signal-prune.js';

const dryRun = process.argv.includes('--dry-run');
const manager = new CuratedSignalsManager();
const result = pruneSignals(manager, { dryRun });

console.log(
  JSON.stringify(
    {
      dry_run: result.dryRun,
      removed: result.removed,
      kept: result.kept,
    },
    null,
    2,
  ),
);