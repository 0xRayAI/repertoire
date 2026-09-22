import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GrooverLogIngester } from './ingestion/groover-log-ingester.js';
import { discoverFieldLogDirs, shouldAutoSyncField } from './paths.js';
import {
  CuratedSignalsManager,
  isFieldPrimitiveName,
} from './registry/CuratedSignalsManager.js';
import { InferenceStateManager } from './registry/InferenceStateManager.js';
import { RepertoireService } from './RepertoireService.js';

describe('field memory (domain dest, not 0.1.8 dump)', () => {
  let tmp = '';

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('rejects heading-dump names and accepts field slugs', () => {
    expect(isFieldPrimitiveName('workspace-subject-map')).toBe(true);
    expect(isFieldPrimitiveName('consumption-fit-gap')).toBe(true);
    expect(isFieldPrimitiveName('model-latent-geometry-as-true-invariant')).toBe(false);
    expect(isFieldPrimitiveName('criteria_selection_gap')).toBe(false);
    expect(isFieldPrimitiveName('phase-3-exhaustive-code-digestion-dynamo-chrono-warp-drive')).toBe(
      false,
    );
    expect(isFieldPrimitiveName('7-final-statement')).toBe(false);
    expect(isFieldPrimitiveName('ab')).toBe(false);
  });

  it('proposes unknown field names on observe and skips heading dumps', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-propose-'));
    const signalsPath = join(tmp, 'curated_signals.json');
    writeFileSync(signalsPath, JSON.stringify({ schema_version: '1.1', signals: [] }));
    const manager = new CuratedSignalsManager(signalsPath);

    const grown = manager.recordPrimitiveObservations([
      { name: 'workspace-subject-map', confidence: 0.9 },
      { name: 'model-latent-geometry-as-true-invariant', confidence: 0.9 },
      { name: 'phase-3-exhaustive-code-digestion-dynamo-chrono-warp-drive', confidence: 0.9 },
    ]);

    expect(grown).toEqual(['workspace-subject-map']);
    const signal = manager.getByName('workspace-subject-map');
    expect(signal?.status).toBe('proposed');
    expect(signal?.tags).toContain('field-observed');
    expect(signal?.observation_stats?.observation_count).toBe(1);
    expect(manager.getByName('phase-3-exhaustive-code-digestion-dynamo-chrono-warp-drive')).toBeUndefined();
  });

  it('ingests enriched JSONL into dest, marks post ids, and routes domain text', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-field-ingest-'));
    const sourceDir = join(tmp, 'field');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, '2026-09-21.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-09-21T00:00:00.000Z',
        source: 'groover',
        post_id: 'post-field-1',
        inference: 'TYPE: ontological-trap\nworkspace subject map as dest memory',
        matched_primitives: ['workspace-subject-map', 'consumption-fit-gap'],
        match_confidence: {
          'workspace-subject-map': 0.91,
          'consumption-fit-gap': 0.88,
        },
      })}\n${JSON.stringify({
        timestamp: '2026-09-21T00:01:00.000Z',
        source: 'groover',
        post_id: 'post-field-2',
        inference: 'consumption fit gap and workspace subject map',
        matched_primitives: ['consumption-fit-gap', 'workspace-subject-map'],
        match_confidence: {
          'consumption-fit-gap': 0.86,
          'workspace-subject-map': 0.84,
        },
      })}\n`,
    );

    const service = new RepertoireService({
      projectRoot: tmp,
      signalsPath: join(tmp, 'curated_signals.json'),
      logDir: join(tmp, 'logs'),
      statePath: join(tmp, 'inference-state.json'),
      syncField: false,
    });
    writeFileSync(join(tmp, 'curated_signals.json'), JSON.stringify({ schema_version: '1.1', signals: [] }));

    const result = service.syncFieldMemory([sourceDir]);
    expect(result.imported).toBe(2);
    expect(result.promoted).toEqual(
      expect.arrayContaining(['consumption-fit-gap']),
    );

    expect(service.signalsManager.getByName('workspace-subject-map')?.observation_stats?.observation_count).toBe(2);
    expect(service.signalsManager.getByName('consumption-fit-gap')?.status).toBe('validated');
    expect(service.signalsManager.getByName('criteria_selection_gap')).toBeUndefined();
    expect(service.stateManager.countProcessed()).toBeGreaterThan(0);
    expect(service.stateManager.isProcessed('post-field-1')).toBe(true);

    const conf = service.getTaskConfidence({
      description: 'The workspace subject map as dest memory and the consumption fit gap.',
    });
    expect(conf.matchedSignals).toEqual(
      expect.arrayContaining(['workspace-subject-map', 'consumption-fit-gap']),
    );
  });

  it('discoverFieldLogDirs uses REPERTOIRE_FIELD_LOGS only — Groover is not Repertoire', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-discover-'));
    const groover = join(tmp, 'research', 'groover-inference-logs-enriched');
    const explicit = join(tmp, 'research', 'project-field-logs');
    mkdirSync(groover, { recursive: true });
    mkdirSync(explicit, { recursive: true });
    writeFileSync(join(groover, 'day.jsonl'), '{"matched_primitives":["attestation-as-map"]}\n');
    writeFileSync(join(explicit, 'day.jsonl'), '{"matched_primitives":["attestation-as-map"]}\n');
    expect(discoverFieldLogDirs(tmp)).toEqual([]);
    const prev = process.env.REPERTOIRE_FIELD_LOGS;
    process.env.REPERTOIRE_FIELD_LOGS = explicit;
    try {
      expect(discoverFieldLogDirs(tmp)).toEqual([explicit]);
    } finally {
      if (prev === undefined) delete process.env.REPERTOIRE_FIELD_LOGS;
      else process.env.REPERTOIRE_FIELD_LOGS = prev;
    }
  });

  it('shouldAutoSyncField stays off under Vitest unless forced', () => {
    expect(shouldAutoSyncField()).toBe(false);
    expect(shouldAutoSyncField(true)).toBe(true);
    expect(shouldAutoSyncField(false)).toBe(false);
  });

  it('marks inference state from the ingester', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-state-mark-'));
    const sourceDir = join(tmp, 'src');
    const targetDir = join(tmp, 'out');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(tmp, 'signals.json'),
      JSON.stringify({
        schema_version: '1.1',
        signals: [
          {
            name: 'attestation-as-map',
            definition: 'map',
            tags: ['trap'],
            priority: 'high',
            status: 'proposed',
            evaluation_criteria: 'x',
            validation_experiment: 'x',
            master_index_integration: 'x',
            implementation_notes: 'x',
          },
        ],
      }),
    );
    writeFileSync(
      join(sourceDir, 'a.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-09-21T00:00:00.000Z',
        source: 'groover',
        post_id: 'p1',
        comment_id: 'c1',
        inference: 'attestation-as-map',
        matched_primitives: ['attestation-as-map'],
        match_confidence: { 'attestation-as-map': 0.9 },
      })}\n`,
    );
    const manager = new CuratedSignalsManager(join(tmp, 'signals.json'));
    const state = new InferenceStateManager(join(tmp, 'state.json'));
    new GrooverLogIngester({
      sourceDir,
      targetDir,
      signalsManager: manager,
      stateManager: state,
    }).ingest();
    expect(state.isProcessed('p1')).toBe(true);
    expect(state.isProcessed('c1')).toBe(true);
    expect(state.countProcessed()).toBe(2);
  });
});
