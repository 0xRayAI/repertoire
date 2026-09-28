import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MetaInferenceEngine,
  MetaInferenceModelError,
  type MetaInferenceModel,
} from './meta-inference-engine.js';
import {
  RepertoireMemoryRoutingProvider,
  createMemoryRoutingProvider,
} from '../provider/memory-routing-provider.js';
import type { InferenceEntry, InferenceState } from '../types.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execSync: () => {
      throw new Error('execSync must not run in unit tests');
    },
  };
});

const SESSION_ID = 'sess-fail-closed';

const REPO_REPORTS = [
  join(process.cwd(), 'logs/meta-inference/synthesis.md'),
  join(process.cwd(), 'logs/meta-inference/dry-synthesis.md'),
];

function sampleEntry(): InferenceEntry {
  return {
    timestamp: '2026-09-28T00:00:00.000Z',
    source: 'groover',
    session_id: SESSION_ID,
    inference: 'a result without a model must not pass',
    post_title: 'fail closed',
  };
}

function readState(statePath: string): InferenceState {
  if (!existsSync(statePath)) {
    return {
      processedCommentIds: [],
      processedSessionIds: [],
      processedPostIds: [],
      lastRun: null,
    };
  }
  return JSON.parse(readFileSync(statePath, 'utf8')) as InferenceState;
}

function snapshotRepoReports(): Map<string, string | null> {
  const snap = new Map<string, string | null>();
  for (const path of REPO_REPORTS) {
    snap.set(path, existsSync(path) ? readFileSync(path, 'utf8') : null);
  }
  return snap;
}

function expectRepoReportsUnchanged(before: Map<string, string | null>): void {
  for (const [path, contents] of before) {
    const after = existsSync(path) ? readFileSync(path, 'utf8') : null;
    expect(after).toBe(contents);
  }
}

describe('MetaInferenceEngine', () => {
  let tmp: string;
  let logDir: string;
  let statePath: string;
  let reportPath: string;
  let errorSpy: { mockRestore: () => void };
  let errorLines: string[];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'meta-inference-'));
    logDir = join(tmp, 'logs');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, 'entries.jsonl'), `${JSON.stringify(sampleEntry())}\n`);
    statePath = join(tmp, 'inference-state.json');
    reportPath = join(tmp, 'synthesis.md');
    errorLines = [];
    errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      if (text.includes('[meta-inference]')) errorLines.push(text.trim());
      return true;
    });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
  });

  function engine(hermesCommand: MetaInferenceModel | null): MetaInferenceEngine {
    return new MetaInferenceEngine({
      logDir,
      statePath,
      reportPath,
      hermesCommand,
    });
  }

  it('model succeeds: entries are processed and a report is written', async () => {
    const report = await engine(() => 'SYNTHESIZED body').run();

    expect(report).toMatchObject({
      entriesProcessed: 1,
      finalReport: 'SYNTHESIZED body',
    });
    expect(report?.batchResults).toEqual(['SYNTHESIZED body']);
    const written = readFileSync(reportPath, 'utf8');
    expect(written).toContain('SYNTHESIZED body');
    expect(written).toContain('Meta-Inference Run');
    expect(written).not.toContain('UNREVIEWED');
    expect(readState(statePath).processedSessionIds).toEqual([SESSION_ID]);
    expect(errorLines).toEqual([]);

    const again = await engine(() => 'should not run').run();
    expect(again).toBeNull();
  });

  it('model throws: entries stay unprocessed and no report is written', async () => {
    const repoReports = snapshotRepoReports();
    const subject = engine(() => {
      throw new Error('hermes exited 1');
    });

    await expect(subject.run()).rejects.toBeInstanceOf(MetaInferenceModelError);
    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_call_failed' });
    await expect(subject.run()).rejects.toThrow(/hermes exited 1/);

    expect(existsSync(reportPath)).toBe(false);
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readState(statePath).processedCommentIds).toEqual([]);
    expect(readState(statePath).lastRun).toBeNull();
    expect(errorLines.some((line) => line.includes('model_call_failed'))).toBe(true);
    expect(errorLines.some((line) => line.includes('hermes exited 1'))).toBe(true);
    expectRepoReportsUnchanged(repoReports);

    subject.configureModel(() => 'retried synthesis');
    const retried = await subject.run();
    expect(retried?.finalReport).toBe('retried synthesis');
    expect(readState(statePath).processedSessionIds).toEqual([SESSION_ID]);
    expect(readFileSync(reportPath, 'utf8')).toContain('retried synthesis');
    expect(readFileSync(reportPath, 'utf8')).not.toContain('UNREVIEWED');
  });

  it('model throws on the final call: partial batch text is not synthesized', async () => {
    let calls = 0;
    const subject = engine(() => {
      calls += 1;
      if (calls === 1) return 'batch only — not a synthesis';
      throw new Error('final call failed');
    });

    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_call_failed' });
    expect(existsSync(reportPath)).toBe(false);
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(calls).toBe(2);
  });

  it('no model configured: entries stay unprocessed and no report is written', async () => {
    const repoReports = snapshotRepoReports();
    const subject = engine(null);

    await expect(subject.run()).rejects.toBeInstanceOf(MetaInferenceModelError);
    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_unavailable' });
    await expect(subject.run()).rejects.toThrow(/not configured/);

    expect(existsSync(reportPath)).toBe(false);
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readState(statePath).lastRun).toBeNull();
    expect(errorLines.some((line) => line.includes('model_unavailable'))).toBe(true);
    expect(errorLines.some((line) => line.includes('execSync must not run'))).toBe(false);
    expectRepoReportsUnchanged(repoReports);
  });

  it('provider refresh reports false when the model throws', async () => {
    const repoReports = snapshotRepoReports();
    const provider = createMemoryRoutingProvider({
      projectRoot: tmp,
      logDir,
      statePath,
      feedbackDir: join(tmp, 'feedback'),
      hermesCommand: () => {
        throw new Error('provider model down');
      },
    });
    expect(provider).toBeInstanceOf(RepertoireMemoryRoutingProvider);
    if (!(provider instanceof RepertoireMemoryRoutingProvider)) {
      throw new Error('expected repertoire provider');
    }
    const signalsBefore = readFileSync(provider.signalsPath, 'utf8');

    const result = await provider.refreshMetaInference();

    expect(result.refreshed).toBe(false);
    expect(result.reason).toBe('model_call_failed');
    expect(result.error).toContain('provider model down');
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readFileSync(provider.signalsPath, 'utf8')).toBe(signalsBefore);
    expect(errorLines.some((line) => line.includes('model_call_failed'))).toBe(true);
    expectRepoReportsUnchanged(repoReports);
  });

  it('provider refresh reports false when no model is configured', async () => {
    const repoReports = snapshotRepoReports();
    const provider = createMemoryRoutingProvider({
      projectRoot: tmp,
      logDir,
      statePath,
      feedbackDir: join(tmp, 'feedback'),
      hermesCommand: null,
    });
    if (!(provider instanceof RepertoireMemoryRoutingProvider)) {
      throw new Error('expected repertoire provider');
    }
    const signalsBefore = readFileSync(provider.signalsPath, 'utf8');

    const result = await provider.refreshMetaInference();

    expect(result.refreshed).toBe(false);
    expect(result.reason).toBe('model_unavailable');
    expect(result.error).toContain('not configured');
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readFileSync(provider.signalsPath, 'utf8')).toBe(signalsBefore);
    expect(existsSync(reportPath)).toBe(false);
    expect(errorLines.some((line) => line.includes('model_unavailable'))).toBe(true);
    expect(errorLines.some((line) => line.includes('execSync must not run'))).toBe(false);
    expectRepoReportsUnchanged(repoReports);
  });
});
