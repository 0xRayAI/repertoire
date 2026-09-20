#!/usr/bin/env node
import { CuratedSignalsManager } from '../src/registry/CuratedSignalsManager.js';
import {
  effectiveSignalConfidence,
  shouldDemoteValidatedSignal,
} from '../src/registry/confidence-decay.js';
import { isRepertoirePackageCwd } from '../src/paths.js';
import { pruneSignals } from '../src/registry/signal-prune.js';

const forceSeed = process.argv.includes('--i-mean-it');
const dryRun =
  process.argv.includes('--dry-run') ||
  (isRepertoirePackageCwd(process.cwd()) && !forceSeed);
const manager = new CuratedSignalsManager();
const demoted = dryRun
  ? manager
      .load()
      .signals.filter((signal) => shouldDemoteValidatedSignal(signal))
      .map((signal) => signal.name)
  : manager.demoteStaleValidatedSignals();
const result = pruneSignals(manager, { dryRun });
const ranked = manager.load().signals.map((signal) => {
  const decayed = effectiveSignalConfidence(signal);
  return {
    name: signal.name,
    status: signal.status,
    stored: decayed?.storedConfidence ?? null,
    effective: decayed?.effectiveConfidence ?? null,
    stale_days: decayed?.staleDays ?? null,
  };
});

console.log(
  JSON.stringify(
    {
      dry_run: result.dryRun,
      demoted,
      removed: result.removed,
      kept: result.kept,
      decay: ranked,
    },
    null,
    2,
  ),
);
