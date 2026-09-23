import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CuratedSignalsManager,
  LESSON_LINE_CAP,
  lawClauseInText,
} from './CuratedSignalsManager.js';
import { getConfidenceForTask } from '../orchestrator-bridge/confidence-gate.js';
import { SignalInjector } from '../orchestrator-bridge/signal-injector.js';
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

  it('seeds above-floor averages so a flatten restores them', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const seen = '2026-09-23T12:00:00.000Z';
    const signal = (
      name: string,
      avg: number,
      evidence?: number,
    ): {
      name: string;
      definition: string;
      tags: string[];
      priority: 'high';
      status: 'validated';
      evaluation_criteria: string;
      validation_experiment: string;
      master_index_integration: string;
      implementation_notes: string;
      observation_stats: {
        observation_count: number;
        avg_confidence: number;
        max_confidence: number;
        last_seen: string;
        governance_forced_count: number;
        evidence_count?: number;
      };
    } => ({
      name,
      definition: `${name} is a named law with a local clause.`,
      tags: ['memory'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'name',
      validation_experiment: 'flatten',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
      observation_stats: {
        observation_count: 9,
        avg_confidence: avg,
        max_confidence: avg,
        last_seen: seen,
        governance_forced_count: 0,
        ...(evidence !== undefined ? { evidence_count: evidence } : {}),
      },
    });
    writeFileSync(
      filePath,
      JSON.stringify({
        description: 'temp dest',
        schema_version: '1.1',
        last_updated: seen,
        signals: [
          signal('attestation-as-map', 0.66),
          signal('heat-is-not-conviction', 0.55),
          signal('floor-dust', 0.55 + 5e-5),
        ],
      }),
    );

    const manager = new CuratedSignalsManager(filePath);
    const learnedPath = join(tempDir, 'learned-conviction.json');
    const learned = JSON.parse(readFileSync(learnedPath, 'utf8')) as {
      signals: Record<string, { avg_confidence: number; evidence_count?: number }>;
    };
    expect(Object.keys(learned.signals)).toEqual(['attestation-as-map']);
    expect(learned.signals['attestation-as-map']?.avg_confidence).toBeCloseTo(0.66, 5);
    expect(learned.signals['attestation-as-map']?.evidence_count).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(learned)).not.toContain('observation_count');
    expect(manager.getByName('heat-is-not-conviction')?.observation_stats?.avg_confidence).toBeCloseTo(
      0.55,
      5,
    );
    expect(manager.getByName('floor-dust')?.observation_stats?.avg_confidence).toBeCloseTo(0.55 + 5e-5, 8);

    const beforeFloor = manager.getByName('attestation-as-map')?.observation_stats;
    manager.recordPrimitiveObservations([{ name: 'attestation-as-map', confidence: 0.55 }]);
    const afterFloor = manager.getByName('attestation-as-map')?.observation_stats;
    expect(afterFloor?.observation_count).toBe((beforeFloor?.observation_count ?? 0) + 1);
    expect(afterFloor?.avg_confidence).toBeCloseTo(0.66, 5);
    expect(afterFloor?.evidence_count).toBeGreaterThanOrEqual(1);
    const route = getConfidenceForTask(
      { id: 'seeded', description: 'attestation-as-map', type: 'general' },
      manager,
    );
    expect(route.complexityBoost).toBe(2);
    const floorRoute = getConfidenceForTask(
      { id: 'floor', description: 'heat-is-not-conviction', type: 'general' },
      manager,
    );
    expect(floorRoute.complexityBoost).toBe(0);
    expect(floorRoute.matchedSignals).not.toContain('attestation-as-map');

    const data = JSON.parse(readFileSync(filePath, 'utf8')) as {
      signals: Array<{
        name: string;
        observation_stats?: { avg_confidence: number; observation_count: number };
      }>;
    };
    const grown = data.signals.find((entry) => entry.name === 'attestation-as-map');
    expect(grown?.observation_stats).toBeDefined();
    if (grown?.observation_stats) {
      grown.observation_stats.avg_confidence = 0.55;
      grown.observation_stats.observation_count = 1;
    }
    writeFileSync(filePath, JSON.stringify(data));

    const woken = new CuratedSignalsManager(filePath);
    const restored = woken.getByName('attestation-as-map')?.observation_stats;
    expect(restored?.avg_confidence).toBeCloseTo(0.66, 5);
    expect(restored?.evidence_count).toBeGreaterThanOrEqual(1);
    expect(restored?.observation_count).toBe(1);
    expect(woken.getByName('heat-is-not-conviction')?.observation_stats?.avg_confidence).toBeCloseTo(
      0.55,
      5,
    );
    const survived = JSON.parse(readFileSync(learnedPath, 'utf8')) as {
      signals: Record<string, { evidence_count?: number }>;
    };
    expect(survived.signals['heat-is-not-conviction']).toBeUndefined();
    expect(survived.signals['floor-dust']).toBeUndefined();
    expect(survived.signals['attestation-as-map']?.evidence_count).toBeGreaterThanOrEqual(1);
  });

  it('keeps a positive evidence count and does not lower a higher survival row', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const seen = '2026-09-23T12:00:00.000Z';
    const row = (name: string, avg: number, evidence: number) => ({
      name,
      definition: `${name} is a named law with a local clause.`,
      tags: ['memory'],
      priority: 'high' as const,
      status: 'validated' as const,
      evaluation_criteria: 'name',
      validation_experiment: 'flatten',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
      observation_stats: {
        observation_count: 3,
        avg_confidence: avg,
        max_confidence: avg,
        last_seen: seen,
        governance_forced_count: 0,
        evidence_count: evidence,
      },
    });
    writeFileSync(
      filePath,
      JSON.stringify({
        description: 'temp dest',
        schema_version: '1.1',
        last_updated: seen,
        signals: [row('parse-mutation-detector', 0.72, 4), row('trust-transfer-boundary', 0.7, 2)],
      }),
    );
    writeFileSync(
      join(tempDir, 'learned-conviction.json'),
      `${JSON.stringify({
        schema_version: '1',
        signals: {
          'parse-mutation-detector': {
            avg_confidence: 0.6,
            evidence_count: 1,
            updated_at: seen,
          },
          'trust-transfer-boundary': {
            avg_confidence: 0.9,
            evidence_count: 3,
            updated_at: seen,
          },
        },
      })}\n`,
    );

    new CuratedSignalsManager(filePath);
    const learned = JSON.parse(readFileSync(join(tempDir, 'learned-conviction.json'), 'utf8')) as {
      signals: Record<string, { avg_confidence: number; evidence_count?: number }>;
    };
    expect(learned.signals['parse-mutation-detector']?.avg_confidence).toBeCloseTo(0.72, 5);
    expect(learned.signals['parse-mutation-detector']?.evidence_count).toBe(4);
    expect(learned.signals['trust-transfer-boundary']?.avg_confidence).toBeCloseTo(0.9, 5);
    expect(learned.signals['trust-transfer-boundary']?.evidence_count).toBe(3);
  });

  it('keeps a graded line beside the average and does not step the same task twice', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);
    manager.addSignal({
      name: 'wake-cascade',
      definition: 'Chat is not the brain. The cascade is the repertoire name wake-cascade.',
      tags: ['cascade'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'named law',
      validation_experiment: 'grade',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
    });
    manager.recordPrimitiveObservations([
      { name: 'wake-cascade', confidence: 0.55 },
      { name: 'wake-cascade', confidence: 0.55 },
    ]);
    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T20:00:00.000Z',
      sessionId: 'sess-1',
      taskId: 'named:wake-cascade:sess-1',
      assignedAgent: 'inference-cycle',
      repertoireSignals: ['wake-cascade'],
      complexity: 0,
      success: true,
      durationMs: 0,
      lesson: 'fix: observe the law',
    });
    const taught = manager.getByName('wake-cascade');
    expect(taught?.lessons).toEqual([{
      taskId: 'named:wake-cascade:sess-1',
      decision: 'success',
      text: 'fix: observe the law',
      at: '2026-09-23T20:00:00.000Z',
    }]);
    const avg = taught?.observation_stats?.avg_confidence ?? 0;
    expect(avg).toBeCloseTo(0.65, 5);
    const learned = JSON.parse(readFileSync(join(tempDir, 'learned-conviction.json'), 'utf8')) as {
      signals: Record<string, { lessons?: Array<{ text: string }> }>;
    };
    expect(learned.signals['wake-cascade']?.lessons?.[0]?.text).toBe('fix: observe the law');

    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T20:05:00.000Z',
      sessionId: 'sess-1',
      taskId: 'named:wake-cascade:sess-1',
      assignedAgent: 'inference-cycle',
      repertoireSignals: ['wake-cascade'],
      complexity: 0,
      success: true,
      durationMs: 0,
      lesson: 'fix: observe the law',
    });
    expect(manager.getByName('wake-cascade')?.observation_stats?.avg_confidence).toBeCloseTo(avg, 5);
    expect(manager.getByName('wake-cascade')?.lessons).toHaveLength(1);

    const route = new SignalInjector(manager, tempDir).buildRoutingContext('wake-cascade');
    expect(route.lessons?.[0]?.name).toBe('wake-cascade');
    expect(route.lessons?.[0]?.lines[0]?.text).toBe('fix: observe the law');
    expect(route.lessons?.[0]?.definition).toContain('Chat is not the brain');

    const data = JSON.parse(readFileSync(filePath, 'utf8')) as {
      signals: Array<{ lessons?: unknown; observation_stats?: { avg_confidence: number } }>;
    };
    const row = data.signals[0];
    if (row?.observation_stats) row.observation_stats.avg_confidence = 0.55;
    if (row) row.lessons = [];
    writeFileSync(filePath, JSON.stringify(data));
    const woken = new CuratedSignalsManager(filePath);
    expect(woken.getByName('wake-cascade')?.observation_stats?.avg_confidence).toBeCloseTo(0.65, 5);
    expect(woken.getByName('wake-cascade')?.lessons?.[0]?.text).toBe('fix: observe the law');
  });

  it('ages a graded line only after its task id is in the ledger', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-signals-'));
    const filePath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(filePath);
    manager.addSignal({
      name: 'wake-cascade',
      definition: 'Chat is not the brain.',
      tags: ['cascade'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'named law',
      validation_experiment: 'grade',
      master_index_integration: 'dest',
      implementation_notes: 'notes',
    });
    manager.recordPrimitiveObservations([
      { name: 'wake-cascade', confidence: 0.55 },
      { name: 'wake-cascade', confidence: 0.55 },
    ]);
    for (let index = 0; index < LESSON_LINE_CAP + 1; index += 1) {
      manager.recordFeedbackOutcome({
        timestamp: '2026-09-23T21:00:00.000Z',
        sessionId: `sess-${index}`,
        taskId: `named:wake-cascade:sess-${index}`,
        assignedAgent: 'inference-cycle',
        repertoireSignals: ['wake-cascade'],
        complexity: 0,
        success: true,
        durationMs: 0,
        lesson: `line ${index}`,
      });
    }
    const signal = manager.getByName('wake-cascade');
    expect(signal?.lessons).toHaveLength(LESSON_LINE_CAP);
    expect(signal?.lessons?.some((line) => line.taskId === 'named:wake-cascade:sess-0')).toBe(false);
    expect(signal?.retained_lesson_ids).toContain('named:wake-cascade:sess-0');
    const held = signal?.observation_stats?.avg_confidence ?? 0;
    manager.recordFeedbackOutcome({
      timestamp: '2026-09-23T22:00:00.000Z',
      sessionId: 'sess-0',
      taskId: 'named:wake-cascade:sess-0',
      assignedAgent: 'inference-cycle',
      repertoireSignals: ['wake-cascade'],
      complexity: 0,
      success: true,
      durationMs: 0,
      lesson: 'line 0',
    });
    expect(manager.getByName('wake-cascade')?.observation_stats?.avg_confidence).toBeCloseTo(held, 5);
    expect(manager.getByName('wake-cascade')?.lessons).toHaveLength(LESSON_LINE_CAP);
  });
});