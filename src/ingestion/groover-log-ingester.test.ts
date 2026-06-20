import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { GrooverLogIngester } from './groover-log-ingester.js';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';

describe('GrooverLogIngester dryRun', () => {
  let tmp: string;
  let sourceDir: string;
  let targetDir: string;
  let signalsPath: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'groover-ingest-'));
    sourceDir = join(tmp, 'source');
    targetDir = join(tmp, 'target');
    signalsPath = join(tmp, 'signals.json');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      signalsPath,
      JSON.stringify({
        schema_version: '1.1',
        signals: [
          {
            name: 'attestation-as-map',
            tags: ['trap'],
            evaluation_criteria: 'test',
            priority: 'high',
            status: 'active',
          },
        ],
      }),
    );
    writeFileSync(
      join(sourceDir, '2026-06-20.jsonl'),
      `${JSON.stringify({
        timestamp: '2026-06-20T12:00:00.000Z',
        source: 'groover',
        post_id: 'post-dry-1',
        inference: 'TYPE: ontological-trap\nattestation-as-map',
        public_reply: 'reply',
        matched_primitives: ['attestation-as-map'],
        match_confidence: { 'attestation-as-map': 0.9 },
      })}\n`,
    );
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('dryRun previews import without writing target logs or mutating signals', () => {
    const manager = new CuratedSignalsManager(signalsPath);
    const before = readFileSync(signalsPath, 'utf8');

    const result = new GrooverLogIngester({
      sourceDir,
      targetDir,
      signalsManager: manager,
      dryRun: true,
    }).ingest();

    expect(result.imported).toBe(1);
    expect(result.promoted).toEqual([]);
    expect(existsSync(join(targetDir, '2026-06-20.jsonl'))).toBe(false);
    expect(readFileSync(signalsPath, 'utf8')).toBe(before);
  });
});