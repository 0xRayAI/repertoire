import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CuratedSignalsManager } from './CuratedSignalsManager.js';
import { pruneSignals, shouldPruneSignal } from './signal-prune.js';
import type { CuratedSignal } from '../types.js';

function stubSignal(overrides: Partial<CuratedSignal>): CuratedSignal {
  return {
    name: 'test-signal',
    definition: 'def',
    tags: [],
    status: 'proposed',
    priority: 'medium',
    ...overrides,
  };
}

describe('signal-prune', () => {
  let tmp: string;
  let path: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-prune-'));
    path = join(tmp, 'curated_signals.json');
    writeFileSync(
      path,
      JSON.stringify({
        schema_version: '1.1',
        signals: [
          stubSignal({
            name: 'stale',
            observation_stats: {
              observation_count: 1,
              avg_confidence: 0.5,
              max_confidence: 0.5,
              last_seen: '2020-01-01',
              governance_forced_count: 0,
            },
          }),
          stubSignal({
            name: 'healthy',
            observation_stats: {
              observation_count: 10,
              avg_confidence: 0.8,
              max_confidence: 0.9,
              last_seen: new Date().toISOString(),
              governance_forced_count: 0,
            },
          }),
        ],
      }),
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('shouldPruneSignal flags low observations', () => {
    const s = stubSignal({ observation_stats: undefined });
    expect(shouldPruneSignal(s, {})).toBe(true);
  });

  it('pruneSignals dry-run does not write', () => {
    const manager = new CuratedSignalsManager(path);
    const result = pruneSignals(manager, { dryRun: true });
    expect(result.removed).toContain('stale');
    expect(result.kept).toBe(1);
    expect(manager.load().signals).toHaveLength(2);
  });

  it('pruneSignals removes stale signals when not dry-run', () => {
    const manager = new CuratedSignalsManager(path);
    const result = pruneSignals(manager, { dryRun: false });
    expect(result.removed).toContain('stale');
    expect(manager.load().signals.map((s) => s.name)).toEqual(['healthy']);
  });
});