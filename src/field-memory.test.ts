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
    expect(isFieldPrimitiveName('model-latent-geometry-as-true-invariant')).toBe(true);
    expect(isFieldPrimitiveName('criteria_selection_gap')).toBe(true);
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
      { name: 'model-latent-geometry-as-true-invariant', confidence: 0.9 },
      { name: 'phase-3-exhaustive-code-digestion-dynamo-chrono-warp-drive', confidence: 0.9 },
    ]);

    expect(grown).toEqual(['model-latent-geometry-as-true-invariant']);
    const signal = manager.getByName('model-latent-geometry-as-true-invariant');
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
        inference: 'TYPE: ontological-trap\nmodel latent geometry as true invariant',
        matched_primitives: ['model-latent-geometry-as-true-invariant', 'criteria_selection_gap'],
        match_confidence: {
          'model-latent-geometry-as-true-invariant': 0.91,
          criteria_selection_gap: 0.88,
        },
      })}\n${JSON.stringify({
        timestamp: '2026-09-21T00:01:00.000Z',
        source: 'groover',
        post_id: 'post-field-2',
        inference: 'criteria selection gap and external norm smuggling',
        matched_primitives: ['criteria_selection_gap', 'external_norm_smuggling_risk'],
        match_confidence: {
          criteria_selection_gap: 0.86,
          external_norm_smuggling_risk: 0.84,
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
      expect.arrayContaining(['criteria_selection_gap']),
    );

    expect(service.signalsManager.getByName('model-latent-geometry-as-true-invariant')?.observation_stats?.observation_count).toBe(1);
    expect(service.signalsManager.getByName('criteria_selection_gap')?.status).toBe('validated');
    expect(service.stateManager.countProcessed()).toBeGreaterThan(0);
    expect(service.stateManager.isProcessed('post-field-1')).toBe(true);

    const conf = service.getTaskConfidence({
      description: 'The model latent geometry as true invariant and the criteria selection gap.',
    });
    expect(conf.matchedSignals).toEqual(
      expect.arrayContaining([
        'model-latent-geometry-as-true-invariant',
        'criteria_selection_gap',
      ]),
    );
  });

  it('discoverFieldLogDirs finds sibling jsonl and ignores empty dirs', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-discover-'));
    const enriched = join(tmp, 'research', 'groover-inference-logs-enriched');
    mkdirSync(enriched, { recursive: true });
    mkdirSync(join(tmp, 'research', 'groover-inference-logs'), { recursive: true });
    writeFileSync(join(enriched, 'day.jsonl'), '{"matched_primitives":["attestation-as-map"]}\n');
    expect(discoverFieldLogDirs(tmp)).toEqual([enriched]);
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
