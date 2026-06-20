import type { CuratedSignal } from '../types.js';
import { CuratedSignalsManager } from './CuratedSignalsManager.js';

export interface PruneOptions {
  minObservations?: number;
  maxStaleDays?: number;
  dryRun?: boolean;
}

export interface PruneResult {
  removed: string[];
  kept: number;
  dryRun: boolean;
}

const DEFAULT_MIN_OBSERVATIONS = 2;
const DEFAULT_MAX_STALE_DAYS = 90;

function daysSince(iso: string | undefined, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = now.getTime() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

export function shouldPruneSignal(
  signal: CuratedSignal,
  opts: PruneOptions,
  now = new Date(),
): boolean {
  const minObs = opts.minObservations ?? DEFAULT_MIN_OBSERVATIONS;
  const maxDays = opts.maxStaleDays ?? DEFAULT_MAX_STALE_DAYS;
  const count = signal.observation_stats?.observation_count ?? 0;
  const lastSeen = signal.observation_stats?.last_seen ?? signal.first_seen;
  return count < minObs || daysSince(lastSeen, now) > maxDays;
}

export function pruneSignals(
  manager: CuratedSignalsManager,
  opts: PruneOptions = {},
): PruneResult {
  const dryRun = opts.dryRun ?? false;
  const data = manager.load();
  const removed: string[] = [];
  const kept: CuratedSignal[] = [];

  for (const signal of data.signals) {
    if (shouldPruneSignal(signal, opts)) {
      removed.push(signal.name);
    } else {
      kept.push(signal);
    }
  }

  if (!dryRun && removed.length > 0) {
    data.signals = kept;
    manager.save(data);
  }

  return { removed, kept: kept.length, dryRun };
}