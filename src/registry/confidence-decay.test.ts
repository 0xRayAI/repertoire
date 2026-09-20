import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from './CuratedSignalsManager.js';
import {
  DEFAULT_DECAY_GRACE_DAYS,
  decayFactorForAge,
  effectiveObservationConfidence,
  rawDecayedConfidence,
  shouldDemoteValidatedSignal,
} from './confidence-decay.js';
import { DEFAULT_PROMOTION_MIN_CONFIDENCE } from './CuratedSignalsManager.js';
import type { CuratedSignal } from '../types.js';

function stub(overrides: Partial<CuratedSignal>): CuratedSignal {
  return {
    name: 'field-signal',
    definition: 'A project-local primitive.',
    tags: ['ontological-trap'],
    priority: 'high',
    status: 'validated',
    evaluation_criteria: 'criteria',
    validation_experiment: 'experiment',
    master_index_integration: 'integration',
    implementation_notes: 'notes',
    ...overrides,
  };
}

describe('confidence decay', () => {
  it('keeps full strength inside the grace window', () => {
    expect(decayFactorForAge(0)).toBe(1);
    expect(decayFactorForAge(DEFAULT_DECAY_GRACE_DAYS)).toBe(1);
  });

  it('halves excess after one half-life past grace', () => {
    const factor = decayFactorForAge(DEFAULT_DECAY_GRACE_DAYS + 60, {
      halfLifeDays: 60,
    });
    expect(factor).toBeCloseTo(0.5, 5);
  });

  it('floors factory-gate scores so seed primitives keep routing', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const result = effectiveObservationConfidence(0.55, '2026-07-07T18:17:42.741Z', {
      now,
    });
    expect(result.effectiveConfidence).toBe(0.55);
    expect(result.staleDays).toBeGreaterThan(60);
  });

  it('fades excess above the gate without dropping below it', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const lastSeen = new Date(now.getTime() - (14 + 60) * 24 * 60 * 60 * 1000).toISOString();
    const result = effectiveObservationConfidence(0.95, lastSeen, { now, halfLifeDays: 60 });
    expect(result.effectiveConfidence).toBeCloseTo(0.55 + 0.4 * 0.5, 5);
    expect(result.effectiveConfidence).toBeGreaterThanOrEqual(DEFAULT_PROMOTION_MIN_CONFIDENCE);
    expect(result.decayFactor).toBeCloseTo(0.5, 5);
  });

  it('does not demote factory-scale validated corpora', () => {
    const signal = stub({
      observation_stats: {
        observation_count: 580,
        avg_confidence: 0.5536,
        max_confidence: 1,
        last_seen: '2026-06-01T00:00:00.000Z',
        governance_forced_count: 500,
      },
    });
    expect(shouldDemoteValidatedSignal(signal, { now: new Date('2026-09-20T00:00:00.000Z') })).toBe(
      false,
    );
  });

  it('demotes a small validated signal whose raw decay falls under the gate', () => {
    const signal = stub({
      observation_stats: {
        observation_count: 3,
        avg_confidence: 0.6,
        max_confidence: 0.7,
        last_seen: '2025-01-01T00:00:00.000Z',
        governance_forced_count: 0,
      },
    });
    expect(
      rawDecayedConfidence(0.6, '2025-01-01T00:00:00.000Z', {
        now: new Date('2026-09-20T00:00:00.000Z'),
      }),
    ).toBeLessThan(DEFAULT_PROMOTION_MIN_CONFIDENCE);
    expect(
      shouldDemoteValidatedSignal(signal, { now: new Date('2026-09-20T00:00:00.000Z') }),
    ).toBe(true);
  });
});

describe('CuratedSignalsManager demotion', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes proposed status for stale local signals only', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-decay-'));
    const manager = new CuratedSignalsManager(join(tempDir, 'curated_signals.json'));
    manager.addSignal(
      stub({
        name: 'stale-local',
        observation_stats: {
          observation_count: 3,
          avg_confidence: 0.62,
          max_confidence: 0.7,
          last_seen: '2025-01-01T00:00:00.000Z',
          governance_forced_count: 0,
        },
      }),
    );
    manager.addSignal(
      stub({
        name: 'factory-scale',
        observation_stats: {
          observation_count: 200,
          avg_confidence: 0.7,
          max_confidence: 1,
          last_seen: '2025-01-01T00:00:00.000Z',
          governance_forced_count: 10,
        },
      }),
    );

    const demoted = manager.demoteStaleValidatedSignals({
      now: new Date('2026-09-20T00:00:00.000Z'),
    });

    expect(demoted).toEqual(['stale-local']);
    expect(manager.getByName('stale-local')?.status).toBe('proposed');
    expect(manager.getByName('factory-scale')?.status).toBe('validated');
  });
});
