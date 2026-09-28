import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MetaInferenceEngine,
  MetaInferenceModelError,
  MODEL_BACKOFF_BASE_MS,
  MODEL_BACKOFF_CAP_MS,
  formatMetaInferenceFailure,
  modelBackoffDelayMs,
  type MetaInferenceModel,
} from './meta-inference-engine.js';
import {
  RepertoireMemoryRoutingProvider,
  createMemoryRoutingProvider,
} from '../provider/memory-routing-provider.js';
import type { InferenceEntry, InferenceState } from '../types.js';

const execState = vi.hoisted(() => ({ mode: 'forbidden' as 'forbidden' | 'enoent' }));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execSync: () => {
      if (execState.mode === 'enoent') {
        const error = new Error('spawnSync hermes ENOENT');
        (error as NodeJS.ErrnoException).code = 'ENOENT';
        throw error;
      }
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
    execState.mode = 'forbidden';
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

  function engine(
    hermesCommand: MetaInferenceModel | null | undefined,
    now?: () => Date,
  ): MetaInferenceEngine {
    return new MetaInferenceEngine({
      logDir,
      statePath,
      reportPath,
      ...(hermesCommand !== undefined ? { hermesCommand } : {}),
      ...(now ? { now } : {}),
    });
  }

  async function expectInvalidOutput(returned: unknown): Promise<void> {
    const repoReports = snapshotRepoReports();
    await expect(engine(() => returned).run()).rejects.toMatchObject({
      reason: 'model_output_invalid',
    });
    expect(existsSync(reportPath)).toBe(false);
    const state = readState(statePath);
    expect(state.processedSessionIds).toEqual([]);
    expect(state.lastRun).toBeNull();
    expect(errorLines.some((line) => line.includes('model_output_invalid'))).toBe(true);
    expectRepoReportsUnchanged(repoReports);

    const providerState = join(tmp, 'provider-inference-state.json');
    const provider = createMemoryRoutingProvider({
      projectRoot: tmp,
      logDir,
      statePath: providerState,
      feedbackDir: join(tmp, 'feedback'),
      hermesCommand: () => returned,
    });
    const refresh = await provider.refreshMetaInference();
    expect(refresh.refreshed).toBe(false);
    expect(refresh.reason).toBe('model_output_invalid');
    expect(readState(providerState).processedSessionIds).toEqual([]);
    expect(readState(providerState).lastRun).toBeNull();
    expect(existsSync(join(tmp, 'logs', 'meta-inference', 'synthesis.md'))).toBe(false);
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
    let nowMs = Date.parse('2026-09-28T12:00:00.000Z');
    const subject = engine(
      () => {
        throw new Error('hermes exited 1');
      },
      () => new Date(nowMs),
    );

    let caught: unknown;
    try {
      await subject.run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MetaInferenceModelError);
    expect(caught).toMatchObject({ reason: 'model_call_failed' });
    expect((caught as Error).message).toContain('hermes exited 1');

    expect(existsSync(reportPath)).toBe(false);
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readState(statePath).processedCommentIds).toEqual([]);
    expect(readState(statePath).lastRun).toBeNull();
    expect(errorLines.some((line) => line.includes('model_call_failed'))).toBe(true);
    expect(errorLines.some((line) => line.includes('hermes exited 1'))).toBe(true);
    expectRepoReportsUnchanged(repoReports);

    nowMs += MODEL_BACKOFF_BASE_MS;
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

    let caught: unknown;
    try {
      await subject.run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MetaInferenceModelError);
    expect(caught).toMatchObject({ reason: 'model_unavailable' });
    expect((caught as Error).message).toContain('not configured');

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

  it('model output invalid: empty string', async () => {
    await expectInvalidOutput('');
  });

  it('model output invalid: whitespace', async () => {
    await expectInvalidOutput(' \n\t ');
  });

  it('model output invalid: bad JSON', async () => {
    await expectInvalidOutput('{not json');
  });

  it('model output invalid: undefined', async () => {
    await expectInvalidOutput(undefined);
  });

  it('model output invalid: null', async () => {
    await expectInvalidOutput(null);
  });

  it('model output invalid: object', async () => {
    await expectInvalidOutput({ synthesized: true });
  });

  it('model output invalid: Promise', async () => {
    await expectInvalidOutput(Promise.resolve('SYNTHESIZED body'));
  });

  it('missing hermes CLI reports model_unavailable', async () => {
    execState.mode = 'enoent';
    const subject = engine(undefined);
    let caught: unknown;
    try {
      await subject.run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MetaInferenceModelError);
    expect(caught).toMatchObject({ reason: 'model_unavailable' });
    expect((caught as Error).message).toContain('hermes CLI not found');
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readState(statePath).lastRun).toBeNull();
    expect(existsSync(reportPath)).toBe(false);
    expect(errorLines.some((line) => line.includes('model_call_failed'))).toBe(false);
  });

  it('corrupt state file is state_error and refresh reports false', async () => {
    writeFileSync(statePath, '{');
    let caught: unknown;
    try {
      await engine(() => 'SYNTHESIZED body').run();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MetaInferenceModelError);
    expect(caught).toMatchObject({ reason: 'state_error' });
    expect((caught as Error).message).not.toContain('model_call_failed');
    expect(readFileSync(statePath, 'utf8')).toBe('{');
    expect(existsSync(reportPath)).toBe(false);

    const provider = createMemoryRoutingProvider({
      projectRoot: tmp,
      logDir,
      statePath,
      feedbackDir: join(tmp, 'feedback'),
      hermesCommand: () => 'SYNTHESIZED body',
    });
    const refresh = await provider.refreshMetaInference();
    expect(refresh.refreshed).toBe(false);
    expect(refresh.reason).toBe('state_error');
    expect(refresh.reason).not.toBe('model_call_failed');
    expect(existsSync(join(tmp, 'logs', 'meta-inference', 'synthesis.md'))).toBe(false);
  });

  it('backoff skips model calls until the window passes', async () => {
    expect(modelBackoffDelayMs(1)).toBe(MODEL_BACKOFF_BASE_MS);
    expect(modelBackoffDelayMs(2)).toBe(MODEL_BACKOFF_BASE_MS * 2);
    expect(modelBackoffDelayMs(20)).toBe(MODEL_BACKOFF_CAP_MS);

    let nowMs = Date.parse('2026-09-28T12:00:00.000Z');
    let calls = 0;
    const subject = engine(
      () => {
        calls += 1;
        throw new Error('hermes down');
      },
      () => new Date(nowMs),
    );

    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_call_failed' });
    expect(calls).toBe(1);

    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_backoff' });
    expect(calls).toBe(1);
    expect(readState(statePath).processedSessionIds).toEqual([]);
    expect(readState(statePath).lastRun).toBeNull();

    nowMs += MODEL_BACKOFF_BASE_MS - 1;
    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_backoff' });
    expect(calls).toBe(1);

    nowMs += 1;
    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_call_failed' });
    expect(calls).toBe(2);

    nowMs += MODEL_BACKOFF_BASE_MS;
    await expect(subject.run()).rejects.toMatchObject({ reason: 'model_backoff' });
    expect(calls).toBe(2);

    nowMs += MODEL_BACKOFF_BASE_MS;
    subject.configureModel(() => {
      calls += 1;
      return 'SYNTHESIZED after backoff';
    });
    const report = await subject.run();
    expect(report?.finalReport).toBe('SYNTHESIZED after backoff');
    expect(readState(statePath).processedSessionIds).toEqual([SESSION_ID]);
    expect(readState(statePath).modelBackoff).toBeUndefined();
  });

  it('formatMetaInferenceFailure is one line and names the reason', () => {
    const modelLine = formatMetaInferenceFailure(
      new MetaInferenceModelError('model_output_invalid', 'meta-inference model returned empty output'),
    );
    expect(modelLine).toBe(
      'meta-inference failed: model_output_invalid: meta-inference model returned empty output',
    );
    expect(modelLine.includes('\n')).toBe(false);

    const stack = new Error('disk failed');
    stack.stack = 'Error: disk failed\n    at run (engine.ts:1:1)';
    const stateLine = formatMetaInferenceFailure(stack);
    expect(stateLine.startsWith('meta-inference failed: state_error: disk failed')).toBe(true);
    expect(stateLine.includes('\n')).toBe(false);
    expect(stateLine.includes('at run')).toBe(false);
  });

  it('provider success writes the report under the project root', async () => {
    const repoReports = snapshotRepoReports();
    const provider = createMemoryRoutingProvider({
      projectRoot: tmp,
      logDir,
      statePath,
      feedbackDir: join(tmp, 'feedback'),
      hermesCommand: () => 'SYNTHESIZED body',
    });
    const result = await provider.refreshMetaInference();
    expect(result).toMatchObject({ refreshed: true, reason: 'synthesized' });
    const written = readFileSync(join(tmp, 'logs', 'meta-inference', 'synthesis.md'), 'utf8');
    expect(written).toContain('SYNTHESIZED body');
    expect(written).not.toContain('UNREVIEWED');
    expectRepoReportsUnchanged(repoReports);
  });
});
