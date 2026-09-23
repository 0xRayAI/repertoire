import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CuratedSignalsManager,
  lawClauseInText,
} from './CuratedSignalsManager.js';
import { getConfidenceForTask } from '../orchestrator-bridge/confidence-gate.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

describe('CuratedSignalsManager confidence tracking', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('records observation stats and promotes qualified proposed signals', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'proposed',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Test static attestation post.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.8 }],
      { governanceForced: false },
    );

    const signal = manager.getByName('attestation-as-map');
    expect(signal?.observation_stats?.observation_count).toBe(2);
    expect(signal?.observation_stats?.avg_confidence).toBeCloseTo(0.85, 3);
    expect(signal?.observation_stats?.governance_forced_count).toBe(1);

    const promoted = manager.promoteQualifiedSignals();
    expect(promoted).toEqual(['attestation-as-map']);
    expect(manager.getByName('attestation-as-map')?.status).toBe('validated');
  });

  it('skips observations below the confidence gate', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'low-confidence-signal',
      definition: 'Low confidence only.',
      tags: ['test'],
      priority: 'low',
      status: 'proposed',
      evaluation_criteria: 'criteria',
      validation_experiment: 'experiment',
      master_index_integration: 'integration',
      implementation_notes: 'notes',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'low-confidence-signal', confidence: 0.4 }],
      { governanceForced: false },
    );

    expect(manager.getByName('low-confidence-signal')?.observation_stats).toBeUndefined();
    expect(manager.promoteQualifiedSignals()).toEqual([]);
  });

  it('records feedback outcomes and nudges confidence on success', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'attestation-as-map',
      definition: 'Attestation is directional.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Map vs verdict language.',
      validation_experiment: 'Test static attestation post.',
      master_index_integration: 'Register as signal type.',
      implementation_notes: 'Enforce on trap entries.',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'attestation-as-map', confidence: 0.9 }],
      { governanceForced: true },
    );

    const before = manager.getByName('attestation-as-map')?.observation_stats?.avg_confidence;
    const results = manager.recordFeedbackOutcome({
      timestamp: '2026-06-18T12:00:00.000Z',
      sessionId: 'sess-feedback-1',
      taskId: 'trap-routing-task',
      assignedAgent: 'architect',
      repertoireSignals: ['attestation-as-map'],
      complexity: 45,
      success: true,
      durationMs: 1800,
    });

    const signal = manager.getByName('attestation-as-map');
    expect(results).toHaveLength(1);
    expect(results[0]?.signalName).toBe('attestation-as-map');
    expect(signal?.feedback_stats?.outcome_count).toBe(1);
    expect(signal?.feedback_stats?.success_count).toBe(1);
    expect(signal?.feedback_stats?.last_assigned_agent).toBe('architect');
    expect(signal?.observation_stats?.avg_confidence).toBeGreaterThan(before ?? 0);
  });

  it('penalizes confidence on failed routing outcomes', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);

    manager.addSignal({
      name: 'parse-mutation-detector',
      definition: 'Detect parse mutations.',
      tags: ['ontological-trap'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'criteria',
      validation_experiment: 'experiment',
      master_index_integration: 'integration',
      implementation_notes: 'notes',
    });

    manager.recordPrimitiveObservations(
      [{ name: 'parse-mutation-detector', confidence: 0.8 }],
      { governanceForced: true },
    );
    manager.recordPrimitiveObservations(
      [{ name: 'parse-mutation-detector', confidence: 0.8 }],
      { governanceForced: false },
    );

    const before = manager.getByName('parse-mutation-detector')?.observation_stats?.avg_confidence;
    manager.recordFeedbackOutcome({
      timestamp: '2026-06-18T12:05:00.000Z',
      sessionId: 'sess-feedback-2',
      taskId: 'failed-trap-task',
      assignedAgent: 'architect',
      repertoireSignals: ['parse-mutation-detector'],
      complexity: 50,
      success: false,
      durationMs: 4200,
    });

    const after = manager.getByName('parse-mutation-detector')?.observation_stats?.avg_confidence;
    expect(after).toBeLessThan(before ?? 1);
    expect(after).toBeCloseTo((before ?? 1) - 0.1, 5);
    expect(manager.getByName('parse-mutation-detector')?.feedback_stats?.failure_count).toBe(1);
  });

  it('keeps a floor observation mass from moving conviction or the route', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);
    const definition =
      'Clearing hangar. x402 pay rail: spend USDC only on live endpoints, never twice. Sells receipted URL extracts. Not a suit.';
    manager.addSignal({
      name: 'repo-clearing',
      definition,
      tags: ['subject', 'hangar'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'name or definition clause',
      validation_experiment: 'clause',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
    });
    manager.recordPrimitiveObservations(
      [{ name: 'repo-clearing', confidence: 0.55 }],
      { governanceForced: false },
    );
    for (let i = 0; i < 40; i += 1) {
      manager.recordPrimitiveObservations([{ name: 'repo-clearing', confidence: 0.55 }]);
    }
    const mass = manager.getByName('repo-clearing')?.observation_stats;
    expect(mass?.observation_count).toBe(41);
    expect(mass?.avg_confidence).toBeCloseTo(0.55, 5);
    expect(mass?.evidence_count).toBe(0);

    const floor = getConfidenceForTask(
      { id: 'floor', description: 'repo-clearing pays a live endpoint', type: 'general' },
      manager,
    );
    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T18:00:00.000Z',
      sessionId: 'learn-1',
      taskId: 'use-the-law',
      assignedAgent: 'architect',
      repertoireSignals: ['repo-clearing'],
      complexity: 20,
      success: true,
      durationMs: 10,
    });
    const learned = getConfidenceForTask(
      { id: 'learned', description: 'repo-clearing pays a live endpoint', type: 'general' },
      manager,
    );
    expect(learned.maxConfidence).toBeCloseTo(0.65, 5);
    expect(learned.complexityBoost).toBeGreaterThan(floor.complexityBoost);
    expect(existsSync(join(tempDir, 'learned-conviction.json'))).toBe(true);

    const failed = manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T18:01:00.000Z',
      sessionId: 'learn-2',
      taskId: 'refute-the-law',
      assignedAgent: 'architect',
      repertoireSignals: ['repo-clearing'],
      complexity: 20,
      success: false,
      durationMs: 10,
    });
    expect(failed[0]?.updatedAvgConfidence).toBeCloseTo(0.55, 5);
    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T18:02:00.000Z',
      sessionId: 'learn-3',
      taskId: 'refute-again',
      assignedAgent: 'architect',
      repertoireSignals: ['repo-clearing'],
      complexity: 20,
      success: false,
      durationMs: 10,
    });
    const dropped = getConfidenceForTask(
      { id: 'dropped', description: 'repo-clearing pays a live endpoint', type: 'general' },
      manager,
    );
    expect(dropped.matchedSignals).not.toContain('repo-clearing');
    expect(dropped.complexityBoost).toBe(0);
  });

  it('finds a definition clause and misses x402 prose', () => {
    const definition =
      'Clearing hangar. x402 pay rail: spend USDC only on live endpoints, never twice. Sells receipted URL extracts. Not a suit.';
    const prose = 'Pay only live x402 services. Never double-pay. Receipted URL extract catalog.';
    const paraphrase = 'spend USDC only on live endpoints, never twice';
    expect(lawClauseInText(definition, prose)).toBe(false);
    expect(lawClauseInText(definition, paraphrase)).toBe(true);
    expect(lawClauseInText(definition, 'spend USDC currency on live endpoints')).toBe(true);
    expect(lawClauseInText(definition, 'clearing hangar')).toBe(false);
    const scattered = [
      'spend',
      ...Array.from({ length: 12 }, () => 'alpha'),
      'usdc',
      ...Array.from({ length: 12 }, () => 'beta'),
      'live',
      ...Array.from({ length: 12 }, () => 'gamma'),
      'endpoints',
    ].join(' ');
    expect(lawClauseInText(definition, scattered)).toBe(false);

    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const manager = new CuratedSignalsManager(join(tempDir, 'curated_signals.json'));
    manager.addSignal({
      name: 'repo-clearing',
      definition,
      tags: ['subject'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'clause',
      validation_experiment: 'clause',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
      observation_stats: {
        observation_count: 2,
        avg_confidence: 0.55,
        max_confidence: 0.55,
        last_seen: '2026-09-23T00:00:00.000Z',
        governance_forced_count: 0,
      },
    });
    const missed = manager.matchByText(prose, 2);
    expect(missed.map((match) => match.signal.name)).not.toContain('repo-clearing');
    const hit = manager.matchByText(paraphrase, 2);
    expect(hit.map((match) => match.signal.name)).toContain('repo-clearing');
    expect(hit[0]?.matchedOn).toContain('definition');
  });

  it('restores learned conviction when dest is flattened to the floor', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);
    manager.addSignal({
      name: 'heat-is-not-conviction',
      definition: 'Heat touches last_seen and does not append a confidence sample.',
      tags: ['memory'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'count is not conviction',
      validation_experiment: 'feedback',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
    });
    manager.recordPrimitiveObservations([
      { name: 'heat-is-not-conviction', confidence: 0.55 },
      { name: 'heat-is-not-conviction', confidence: 0.55 },
    ]);
    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T18:00:00.000Z',
      sessionId: 'persist',
      taskId: 'outcome',
      assignedAgent: 'architect',
      repertoireSignals: ['heat-is-not-conviction'],
      complexity: 12,
      success: true,
      durationMs: 5,
    });
    const learnedPath = join(tempDir, 'learned-conviction.json');
    const learned = JSON.parse(readFileSync(learnedPath, 'utf8')) as {
      signals: Record<string, { avg_confidence: number }>;
    };
    expect(learned.signals['heat-is-not-conviction']?.avg_confidence).toBeCloseTo(0.65, 5);
    expect(JSON.stringify(learned)).not.toContain('observation_count');

    const data = JSON.parse(readFileSync(filePath, 'utf8')) as {
      signals: Array<{ observation_stats?: { avg_confidence: number; observation_count: number } }>;
    };
    const stats = data.signals[0]?.observation_stats;
    expect(stats).toBeDefined();
    if (stats) {
      stats.avg_confidence = 0.55;
      stats.observation_count = 1;
    }
    writeFileSync(filePath, JSON.stringify(data));
    const woken = new CuratedSignalsManager(filePath);
    const restored = woken.getByName('heat-is-not-conviction')?.observation_stats;
    expect(restored?.avg_confidence).toBeCloseTo(0.65, 5);
    expect(restored?.observation_count).toBe(1);
  });
});