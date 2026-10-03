import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { SynthesisPromptBuilder } from './synthesis-prompt-builder.js';
import { InferenceStateManager } from '../registry/InferenceStateManager.js';
import type { InferenceEntry, InferenceState, SynthesisReport } from '../types.js';

export type MetaInferenceModel = (prompt: string) => unknown;

export type MetaInferenceFailureReason =
  | 'model_unavailable'
  | 'model_call_failed'
  | 'model_output_invalid'
  | 'model_backoff'
  | 'state_error';

/** First wait after a failed model attempt. Doubles until MODEL_BACKOFF_CAP_MS. */
export const MODEL_BACKOFF_BASE_MS = 15 * 60 * 1000;
/** Upper bound so a dead hermes CLI cannot push the wait without limit. */
export const MODEL_BACKOFF_CAP_MS = 4 * 60 * 60 * 1000;

export function modelBackoffDelayMs(failures: number): number {
  const exponent = Math.max(0, Math.min(failures, 16) - 1);
  const doubled = MODEL_BACKOFF_BASE_MS * 2 ** exponent;
  return Math.min(doubled, MODEL_BACKOFF_CAP_MS);
}

export function formatMetaInferenceFailure(error: unknown): string {
  if (error instanceof MetaInferenceModelError) {
    return oneLine(`meta-inference failed: ${error.reason}: ${error.message}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return oneLine(`meta-inference failed: state_error: ${message}`);
}

/** Raised when synthesis cannot be produced by a model. Callers must not treat it as a report. */
export class MetaInferenceModelError extends Error {
  readonly reason: MetaInferenceFailureReason;

  constructor(
    reason: MetaInferenceFailureReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'MetaInferenceModelError';
    this.reason = reason;
  }
}

export interface MetaInferenceEngineOptions {
  logDir?: string;
  statePath?: string;
  reportPath?: string;
  batchSize?: number;
  maxEntries?: number;
  /**
   * Model call. Omit to use the hermes CLI.
   * `null` means no model is configured — the run fails closed and does not call out.
   */
  hermesCommand?: MetaInferenceModel | null;
  /** Pinned in tests. Defaults to the system clock. */
  now?: () => Date;
}

const DEFAULT_BATCH_SIZE = 1;
const DEFAULT_MAX_ENTRIES = 8;

export class MetaInferenceEngine {
  private readonly logDir: string;
  private readonly stateManager: InferenceStateManager;
  private readonly reportPath: string;
  private readonly batchSize: number;
  private readonly maxEntries: number;
  private readonly promptBuilder = new SynthesisPromptBuilder();
  private readonly now: () => Date;
  private model: MetaInferenceModel | null;

  constructor(options: MetaInferenceEngineOptions = {}) {
    this.logDir = options.logDir ?? 'logs/groover-inference';
    this.stateManager = new InferenceStateManager(options.statePath ?? 'data/inference-state.json');
    this.reportPath = options.reportPath ?? 'logs/meta-inference/synthesis.md';
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? (() => new Date());
    this.model =
      options.hermesCommand === null
        ? null
        : (options.hermesCommand ?? ((prompt: string) => this.defaultHermesCommand(prompt)));
  }

  /** `null` configures no model. The next run fails closed instead of calling the hermes CLI. */
  configureModel(command: MetaInferenceModel | null): void {
    this.model = command;
  }

  async run(): Promise<SynthesisReport | null> {
    const state = this.loadState();
    const processed = new Set([
      ...state.processedCommentIds,
      ...state.processedSessionIds,
      ...state.processedPostIds,
    ]);

    if (!existsSync(this.logDir)) {
      return null;
    }

    const newEntries = this.loadUnprocessedEntries(processed);
    if (newEntries.length === 0) {
      return null;
    }

    const entries = newEntries.slice(0, this.maxEntries);
    this.throwIfBackingOff(state);
    const batchResults: string[] = [];

    let totalPass = 0;
    let totalReject = 0;
    let resonanceSum = 0;
    let resonanceCount = 0;

    for (let i = 0; i < entries.length; i += this.batchSize) {
      const batch = entries.slice(i, i + this.batchSize);

      for (const e of batch) {
        const rec = e.dynamo_result?.result?.recommendation;
        if (rec === 'PASS') totalPass++;
        if (rec === 'REJECT') totalReject++;
        const res = e.dynamo_result?.result?.resonanceScore;
        if (typeof res === 'number') {
          resonanceSum += res;
          resonanceCount++;
        }
      }

      const avgResonance =
        resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

      const prompt = this.promptBuilder.buildBatchPrompt({
        batchIndex: Math.floor(i / this.batchSize) + 1,
        totalBatches: Math.ceil(entries.length / this.batchSize),
        entries: batch,
        globalIndex: i,
        dynamoStats: {
          pass: totalPass,
          reject: totalReject,
          avgResonance,
          analyzedSoFar: i + batch.length,
        },
      });

      batchResults.push(this.callModelOrRecord(prompt));
    }

    const avgResonance =
      resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

    const finalPrompt = this.promptBuilder.buildFinalSynthesisPrompt(
      entries.length,
      { pass: totalPass, reject: totalReject, avgResonance },
      batchResults,
      entries,
    );

    const finalReport = this.callModelOrRecord(finalPrompt);
    this.stateManager.clearModelBackoff();
    this.appendReport(
      entries.length,
      totalPass,
      resonanceCount > 0 ? resonanceSum / resonanceCount : null,
      finalReport,
    );

    const ids = entries.map((e) => e.comment_id ?? e.post_id ?? e.session_id).filter(Boolean) as string[];
    const hasSession = entries.some((e) => e.session_id);
    this.stateManager.markProcessed(ids, hasSession ? 'session' : 'comment');

    return {
      entriesProcessed: entries.length,
      batchResults,
      finalReport,
      timestamp: new Date().toISOString(),
      dynamoStats: {
        pass: totalPass,
        reject: totalReject,
        avgResonance: resonanceCount > 0 ? resonanceSum / resonanceCount : null,
      },
    };
  }

  private loadUnprocessedEntries(processed: Set<string>): InferenceEntry[] {
    const files = readdirSync(this.logDir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort();

    const entries: InferenceEntry[] = [];

    for (const file of files) {
      const lines = readFileSync(join(this.logDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as InferenceEntry;
          const id = entry.comment_id ?? entry.post_id ?? entry.session_id;
          if (id && !processed.has(id)) {
            entries.push(entry);
            processed.add(id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logFailure('malformed_log_line', `skipped malformed log line in ${file}: ${message}`);
        }
      }
    }

    return entries;
  }

  private loadState(): InferenceState {
    try {
      return this.stateManager.load();
    } catch (error) {
      throw this.fail(
        'state_error',
        `meta-inference state could not be read: ${errorText(error)}`,
        error,
      );
    }
  }

  private throwIfBackingOff(state: InferenceState): void {
    const backoff = state.modelBackoff;
    if (!backoff) return;
    const failedAt = Date.parse(backoff.failedAt);
    if (Number.isNaN(failedAt)) return;
    const wait = modelBackoffDelayMs(backoff.failures);
    if (this.now().getTime() - failedAt < wait) {
      throw this.fail(
        'model_backoff',
        `meta-inference model call skipped until backoff ends (${wait}ms)`,
      );
    }
  }

  /**
   * A missing, failed, or junk model result must not produce a synthesis report.
   * Entries stay unprocessed so a later run can retry them.
   */
  private callModelOrRecord(prompt: string): string {
    try {
      return this.callModel(prompt);
    } catch (error) {
      this.noteModelFailure(error);
      throw error;
    }
  }

  private callModel(prompt: string): string {
    if (this.model === null) {
      throw this.fail('model_unavailable', 'meta-inference model is not configured');
    }

    let output: unknown;
    try {
      output = this.model(prompt);
    } catch (error) {
      if (error instanceof MetaInferenceModelError) {
        this.logFailure(error.reason, error.message);
        throw error;
      }
      if (isMissingHermes(error)) {
        throw this.fail(
          'model_unavailable',
          'meta-inference model is not available: hermes CLI not found',
          error,
        );
      }
      throw this.fail(
        'model_call_failed',
        `meta-inference model call failed: ${errorText(error)}`,
        error,
      );
    }

    try {
      return acceptModelOutput(output);
    } catch (error) {
      if (error instanceof MetaInferenceModelError) {
        this.logFailure(error.reason, error.message);
        throw error;
      }
      throw error;
    }
  }

  private noteModelFailure(error: unknown): void {
    if (!(error instanceof MetaInferenceModelError)) return;
    if (error.reason === 'model_backoff' || error.reason === 'state_error') return;
    try {
      this.stateManager.recordModelFailure(this.now().toISOString());
    } catch (recordError) {
      this.logFailure(
        'state_error',
        `could not record model backoff: ${errorText(recordError)}`,
      );
    }
  }

  private fail(
    reason: MetaInferenceFailureReason,
    message: string,
    cause?: unknown,
  ): MetaInferenceModelError {
    const error = new MetaInferenceModelError(
      reason,
      message,
      cause === undefined ? undefined : { cause },
    );
    this.logFailure(reason, message);
    return error;
  }

  private logFailure(reason: string, message: string): void {
    process.stderr.write(`[meta-inference] ${reason}: ${message}\n`);
  }

  private appendReport(
    entryCount: number,
    passCount: number,
    avgResonance: number | null,
    report: string,
  ): void {
    const dir = dirname(this.reportPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const header =
      `\n\n## Meta-Inference Run — ${new Date().toISOString()}\n` +
      `Entries: ${entryCount} | ` +
      `Dynamo PASS rate: ${passCount}/${entryCount} | ` +
      `Avg resonance: ${avgResonance?.toFixed(3) ?? 'N/A'}\n\n`;

    appendFileSync(this.reportPath, header + report);
  }

  private defaultHermesCommand(prompt: string): string {
    const tmpPath = '/tmp/repertoire-meta-inference.txt';
    writeFileSync(tmpPath, prompt);
    const cmd = `hermes -z "$(cat ${tmpPath})" --provider xai-oauth --model grok-4.3`;
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300_000,
    }).trim();
  }
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isMissingHermes(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { code?: unknown; message?: unknown };
  if (record.code === 'ENOENT') return true;
  return typeof record.message === 'string' && record.message.includes('ENOENT');
}

function isThenable(value: unknown): boolean {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  return typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Synthesis text is a non-empty string. A value shaped like JSON must parse.
 * Anything else is not a model result.
 */
function acceptModelOutput(value: unknown): string {
  if (isThenable(value)) {
    throw new MetaInferenceModelError(
      'model_output_invalid',
      'meta-inference model returned a Promise',
    );
  }
  if (value === undefined || value === null) {
    throw new MetaInferenceModelError(
      'model_output_invalid',
      'meta-inference model returned empty output',
    );
  }
  if (typeof value !== 'string') {
    throw new MetaInferenceModelError(
      'model_output_invalid',
      'meta-inference model returned a non-string',
    );
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new MetaInferenceModelError(
      'model_output_invalid',
      'meta-inference model returned empty output',
    );
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
    } catch (error) {
      throw new MetaInferenceModelError(
        'model_output_invalid',
        `meta-inference model returned invalid JSON: ${errorText(error)}`,
        { cause: error },
      );
    }
  }
  return trimmed;
}