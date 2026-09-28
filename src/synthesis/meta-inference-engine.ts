import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { SynthesisPromptBuilder } from './synthesis-prompt-builder.js';
import { InferenceStateManager } from '../registry/InferenceStateManager.js';
import type { InferenceEntry, SynthesisReport } from '../types.js';

export type MetaInferenceModel = (prompt: string) => string;

export type MetaInferenceFailureReason = 'model_unavailable' | 'model_call_failed';

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
  private model: MetaInferenceModel | null;

  constructor(options: MetaInferenceEngineOptions = {}) {
    this.logDir = options.logDir ?? 'logs/groover-inference';
    this.stateManager = new InferenceStateManager(options.statePath ?? 'data/inference-state.json');
    this.reportPath = options.reportPath ?? 'logs/meta-inference/synthesis.md';
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
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
    const state = this.stateManager.load();
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

      batchResults.push(this.callModel(prompt));
    }

    const avgResonance =
      resonanceCount > 0 ? (resonanceSum / resonanceCount).toFixed(3) : 'N/A';

    const finalPrompt = this.promptBuilder.buildFinalSynthesisPrompt(
      entries.length,
      { pass: totalPass, reject: totalReject, avgResonance },
      batchResults,
      entries,
    );

    const finalReport = this.callModel(finalPrompt);
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

  /**
   * A missing or failed model must not produce a synthesis report.
   * Entries stay unprocessed so a later run can retry them.
   */
  private callModel(prompt: string): string {
    if (this.model === null) {
      const error = new MetaInferenceModelError(
        'model_unavailable',
        'meta-inference model is not configured',
      );
      this.logFailure(error.reason, error.message);
      throw error;
    }

    try {
      return this.model(prompt);
    } catch (error) {
      if (error instanceof MetaInferenceModelError) {
        this.logFailure(error.reason, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      const wrapped = new MetaInferenceModelError(
        'model_call_failed',
        `meta-inference model call failed: ${message}`,
        { cause: error },
      );
      this.logFailure(wrapped.reason, wrapped.message);
      throw wrapped;
    }
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