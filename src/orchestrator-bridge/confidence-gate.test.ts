import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import {
  confidenceWeightedAgentBoost,
  getConfidenceForTask,
  TRAP_CAPABLE_AGENTS,
} from './confidence-gate.js';
import type { OrchestrationTask } from '../types.js';

describe('confidence gate', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  function createManager(): CuratedSignalsManager {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-confidence-'));
    const manager = new CuratedSignalsManager(join(tempDir, 'curated_signals.json'));
    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional rather than final.',
      tags: ['ontological-trap', 'attestation'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Static attestation post test.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });
    manager.recordPrimitiveObservations(
      [
        { name: 'attestation-as-map', confidence: 0.9 },
        { name: 'attestation-as-map', confidence: 0.85 },
      ],
      { governanceForced: true },
    );
    return manager;
  }

  it('detects high-confidence ontological-trap tasks', () => {
    const manager = createManager();
    const task: OrchestrationTask = {
      id: 'task-1',
      description: 'TYPE: ontological-trap attestation-as-map closure primitive required',
      type: 'governance',
    };

    const context = getConfidenceForTask(task, manager);

    expect(context.highConfidenceTrapPresent).toBe(true);
    expect(context.complexityBoost).toBeGreaterThan(15);
    expect(context.signals.some((entry) => entry.name === 'attestation-as-map')).toBe(true);
    expect(context.matchedSignals).toContain('attestation-as-map');
    expect(context.recommendedAgent).toBe('architect');
  });

  it('uses decayed excess so stale high scores boost less than fresh ones', () => {
    const manager = createManager();
    const signal = manager.getByName('attestation-as-map');
    expect(signal?.observation_stats).toBeDefined();
    const data = manager.load();
    const stored = data.signals.find((entry) => entry.name === 'attestation-as-map');
    if (stored?.observation_stats) {
      stored.observation_stats.last_seen = '2025-01-01T00:00:00.000Z';
      stored.observation_stats.avg_confidence = 0.95;
    }
    manager.save(data);

    const stale = getConfidenceForTask(
      {
        id: 'task-stale',
        description: 'TYPE: ontological-trap attestation-as-map',
        type: 'governance',
      },
      manager,
    );
    const detail = stale.signals.find((entry) => entry.name === 'attestation-as-map');

    expect(stale.highConfidenceTrapPresent).toBe(true);
    expect(detail?.storedConfidence).toBeCloseTo(0.95, 5);
    expect(detail?.confidence).toBeLessThan(0.95);
    expect(detail?.confidence).toBeGreaterThanOrEqual(0.55);
    expect(detail?.staleDays).toBeGreaterThan(14);
  });

  it('boosts trap-capable agents when high-confidence trap is present', () => {
    const context = getConfidenceForTask(
      {
        id: 'task-2',
        description: 'TYPE: ontological-trap attestation-as-map',
        type: 'governance',
      },
      createManager(),
    );

    expect(confidenceWeightedAgentBoost('architect', context)).toBeGreaterThan(20);
    expect(confidenceWeightedAgentBoost('code-reviewer', context)).toBe(0);
    expect(TRAP_CAPABLE_AGENTS).toContain('architect');
  });
});