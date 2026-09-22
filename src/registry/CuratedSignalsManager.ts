import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  DEFAULT_SIGNALS_PATH,
  hydrateWritableSignals,
  isFactorySeedFile,
  isGenericFieldObservedDefinition,
} from '../paths.js';
import type {
  CuratedSignal,
  CuratedSignalsFile,
  OrchestratorFeedbackEntry,
  PrimitiveMatch,
  SignalMatch,
  SignalPriority,
  SignalStatus,
} from '../types.js';
import {
  effectiveSignalConfidence,
  shouldDemoteValidatedSignal,
  type DecayOptions,
} from './confidence-decay.js';

export interface PromotionGateOptions {
  minAvgConfidence?: number;
  minObservations?: number;
  fromStatus?: SignalStatus;
  toStatus?: SignalStatus;
}

export const DEFAULT_PROMOTION_MIN_CONFIDENCE = 0.55;
export const DEFAULT_PROMOTION_MIN_OBSERVATIONS = 2;
export const FEEDBACK_SUCCESS_CONFIDENCE_BOOST = 0.002;
export const FEEDBACK_FAILURE_CONFIDENCE_PENALTY = 0.005;
export const FEEDBACK_MIN_CONFIDENCE = DEFAULT_PROMOTION_MIN_CONFIDENCE;

const FIELD_PRIMITIVE_NAME = /^[A-Za-z][A-Za-z0-9_-]{2,119}$/;

const GROOVER_EXPERIMENT_NAMES = new Set([
  'criteria_selection_gap',
  'external_norm_smuggling_risk',
  'model-latent-geometry-as-true-invariant',
]);

/** Enriched JSONL names only — not June heading dumps (`phase-3-…`, `7-final-statement`). */
export function isFieldPrimitiveName(name: string): boolean {
  if (!FIELD_PRIMITIVE_NAME.test(name)) return false;
  if (/^phase-\d/i.test(name)) return false;
  if (/^\d/.test(name)) return false;
  if (GROOVER_EXPERIMENT_NAMES.has(name)) return false;
  return true;
}

/** Slug a session/pattern/package label into a dest name, or null. */
export function slugFieldPrimitiveName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const bare = trimmed.replace(/^@[^/]+\//, '');
  const slug = bare
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return isFieldPrimitiveName(slug) ? slug : null;
}

/** Workspace map name — `repo-xray`, not a June heading. */
export function repoPrimitiveName(pkgName: string, dirName?: string): string | null {
  const pkgSlug = slugFieldPrimitiveName(pkgName);
  const dirSlug = dirName ? slugFieldPrimitiveName(dirName) : null;
  const scaffold = pkgSlug != null && (/vite-react/.test(pkgSlug) || /shadcn/.test(pkgSlug));
  const slug = pkgSlug && !scaffold ? pkgSlug : (dirSlug ?? pkgSlug);
  if (!slug) return null;
  const name = slug.startsWith('repo-') ? slug : `repo-${slug}`;
  return isFieldPrimitiveName(name) ? name : null;
}

export function proposeFieldObservedSignal(name: string, now: string): CuratedSignal {
  const spoken = name.replace(/[_-]+/g, ' ').trim();
  return {
    name,
    definition: `${spoken}. Field-observed domain primitive grown from enriched JSONL. Not the factory seed.`,
    tags: ['field-observed', 'domain'],
    priority: 'medium',
    status: 'proposed',
    first_seen: now,
    evaluation_criteria: `Enriched log named ${name} at or above the 0.55 gate.`,
    validation_experiment: 'Ingest field JSONL. Promote after two observations.',
    master_index_integration: 'Project dest only. Factory tarball stays 8 names.',
    implementation_notes: 'Propose-on-observe. Do not copy the 145-name 0.1.8 dump.',
    example_inference_snippet: spoken,
  };
}

export interface FeedbackOutcomeResult {
  signalName: string;
  previousAvgConfidence: number | null;
  updatedAvgConfidence: number | null;
  feedbackStats: NonNullable<CuratedSignal['feedback_stats']>;
}

export class CuratedSignalsManager {
  readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? hydrateWritableSignals(DEFAULT_SIGNALS_PATH);
  }

  load(): CuratedSignalsFile {
    if (!existsSync(this.filePath)) {
      return this.createEmptyFile();
    }
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as CuratedSignalsFile;
  }

  save(data: CuratedSignalsFile): void {
    if (isFactorySeedFile(this.filePath)) {
      throw new Error(
        `Refusing to write factory seed (${this.filePath}). Hydrate a project copy under .xray/state/repertoire/.`,
      );
    }
    data.last_updated = new Date().toISOString();
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Replace a generic field-observed stub with live sibling flesh.
   * Keeps observation stats. Refuses overlay/subject definitions already written.
   */
  fleshGenericRepoSignal(name: string, definition: string, snippet?: string): boolean {
    const data = this.load();
    const signal = data.signals.find((entry) => entry.name === name);
    if (!signal || !isGenericFieldObservedDefinition(signal.definition)) {
      return false;
    }
    signal.definition = definition;
    if (snippet) signal.example_inference_snippet = snippet;
    this.save(data);
    return true;
  }

  addSignal(signal: CuratedSignal): void {
    const data = this.load();
    const exists = data.signals.some((s) => s.name === signal.name);
    if (!exists) {
      data.signals.push(signal);
      this.save(data);
    }
  }

  getByName(name: string): CuratedSignal | undefined {
    return this.load().signals.find((s) => s.name === name);
  }

  getByTag(tag: string): CuratedSignal[] {
    const normalized = tag.toLowerCase();
    return this.load().signals.filter((s) =>
      s.tags.some((t) => t.toLowerCase() === normalized),
    );
  }

  getHighPrioritySignals(): CuratedSignal[] {
    return this.load().signals.filter((s) => s.priority === 'high');
  }

  getByPriority(priority: SignalPriority): CuratedSignal[] {
    return this.load().signals.filter((s) => s.priority === priority);
  }

  /**
   * Score text against all signals using name, tags, definition, criteria, and snippet.
   */
  matchByText(text: string, minScore = 2): SignalMatch[] {
    const normalized = text.toLowerCase();
    const matches: SignalMatch[] = [];

    for (const signal of this.load().signals) {
      const matchedOn: SignalMatch['matchedOn'] = [];
      let score = 0;

      if (normalized.includes(signal.name.replace(/-/g, ' ')) || normalized.includes(signal.name)) {
        score += 5;
        matchedOn.push('name');
      } else if (signal.name.startsWith('repo-')) {
        const tail = signal.name.slice(5);
        if (tail.length >= 3 && new RegExp(`\\b${tail}\\b`, 'i').test(normalized)) {
          score += 5;
          matchedOn.push('name');
        }
      }

      for (const tag of signal.tags) {
        if (normalized.includes(tag.toLowerCase())) {
          score += 3;
          matchedOn.push('tag');
          break;
        }
      }

      const definitionWords = signal.definition
        .toLowerCase()
        .split(/[^\w.]+/)
        .filter((w) => w.length > 5 || (/\d/.test(w) && w.length >= 3));
      const definitionHits = definitionWords.filter((w) => normalized.includes(w)).length;
      if (definitionHits >= 2) {
        score += Math.min(definitionHits, 4);
        matchedOn.push('definition');
      }

      if (signal.evaluation_criteria) {
        const criteriaWords = signal.evaluation_criteria.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
        const criteriaHits = criteriaWords.filter((w) => normalized.includes(w)).length;
        if (criteriaHits >= 2) {
          score += Math.min(criteriaHits, 3);
          matchedOn.push('criteria');
        }
      }

      if (signal.example_inference_snippet) {
        const snippet = signal.example_inference_snippet.toLowerCase().slice(0, 80);
        if (normalized.includes(snippet.slice(0, 40))) {
          score += 4;
          matchedOn.push('snippet');
        }
      }

      if (signal.priority === 'high') score += 1;

      if (score >= minScore) {
        matches.push({ signal, score, matchedOn });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  matchInferenceEntry(inference: string): SignalMatch[] {
    const typeMatch = inference.match(/TYPE:\s*(\S+)/i);
    const type = typeMatch?.[1]?.toLowerCase();

    const matches = this.matchByText(inference, 2);

    if (type === 'ontological-trap') {
      const trapSignals = this.getByTag('ontological-trap');
      for (const signal of trapSignals) {
        if (!matches.some((m) => m.signal.name === signal.name)) {
          matches.push({ signal, score: 3, matchedOn: ['tag'] });
        }
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  recordPrimitiveObservations(
    matches: PrimitiveMatch[],
    options: { governanceForced?: boolean; minConfidence?: number } = {},
  ): string[] {
    const minConfidence = options.minConfidence ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
    const data = this.load();
    const updated: string[] = [];
    const now = new Date().toISOString();

    for (const match of matches) {
      if (match.confidence < minConfidence) continue;

      let signal = data.signals.find((entry) => entry.name === match.name);
      if (!signal) {
        if (!isFieldPrimitiveName(match.name)) continue;
        signal = proposeFieldObservedSignal(match.name, now);
        data.signals.push(signal);
      }

      const previous = signal.observation_stats;
      const observationCount = (previous?.observation_count ?? 0) + 1;
      const totalConfidence = (previous?.avg_confidence ?? 0) * (observationCount - 1) + match.confidence;

      signal.observation_stats = {
        observation_count: observationCount,
        avg_confidence: totalConfidence / observationCount,
        max_confidence: Math.max(previous?.max_confidence ?? 0, match.confidence),
        last_seen: now,
        governance_forced_count:
          (previous?.governance_forced_count ?? 0) + (options.governanceForced ? 1 : 0),
      };
      updated.push(signal.name);
    }

    if (updated.length > 0) {
      this.save(data);
    }

    return updated;
  }

  shouldPromoteSignal(
    signal: CuratedSignal,
    options: PromotionGateOptions = {},
  ): boolean {
    const minAvgConfidence = options.minAvgConfidence ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
    const minObservations = options.minObservations ?? DEFAULT_PROMOTION_MIN_OBSERVATIONS;
    const fromStatus = options.fromStatus ?? 'proposed';
    const stats = signal.observation_stats;

    if ((signal.status ?? 'proposed') !== fromStatus || !stats) {
      return false;
    }

    return (
      stats.avg_confidence >= minAvgConfidence &&
      stats.observation_count >= minObservations
    );
  }

  promoteQualifiedSignals(options: PromotionGateOptions = {}): string[] {
    const toStatus = options.toStatus ?? 'validated';
    const data = this.load();
    const promoted: string[] = [];

    for (const signal of data.signals) {
      if (this.shouldPromoteSignal(signal, options)) {
        signal.status = toStatus;
        promoted.push(signal.name);
      }
    }

    if (promoted.length > 0) {
      this.save(data);
    }

    return promoted;
  }

  getSignalsAboveConfidence(
    minAvgConfidence = DEFAULT_PROMOTION_MIN_CONFIDENCE,
    options: DecayOptions = {},
  ): CuratedSignal[] {
    return this.load().signals.filter((signal) => {
      const decayed = effectiveSignalConfidence(signal, options);
      return (decayed?.effectiveConfidence ?? 0) >= minAvgConfidence;
    });
  }

  /**
   * Demote project-local validated signals whose raw (unfloored) decay
   * dropped below the gate. Factory-scale corpora (≥100 observations) stay.
   */
  demoteStaleValidatedSignals(options: DecayOptions = {}): string[] {
    const data = this.load();
    const demoted: string[] = [];

    for (const signal of data.signals) {
      if (shouldDemoteValidatedSignal(signal, options)) {
        signal.status = 'proposed';
        demoted.push(signal.name);
      }
    }

    if (demoted.length > 0) {
      this.save(data);
    }

    return demoted;
  }

  /**
   * Record orchestrator routing outcome against signals used for the task.
   * Successful outcomes nudge avg_confidence up slightly; failures nudge down.
   */
  recordFeedbackOutcome(entry: OrchestratorFeedbackEntry): FeedbackOutcomeResult[] {
    const data = this.load();
    const now = entry.timestamp || new Date().toISOString();
    const signalNames = [...new Set(entry.repertoireSignals.filter(Boolean))];
    const results: FeedbackOutcomeResult[] = [];

    for (const signalName of signalNames) {
      const signal = data.signals.find((candidate) => candidate.name === signalName);
      if (!signal) continue;

      const previousAvg = signal.observation_stats?.avg_confidence ?? null;
      const previousFeedback = signal.feedback_stats;
      const outcomeCount = (previousFeedback?.outcome_count ?? 0) + 1;

      signal.feedback_stats = {
        outcome_count: outcomeCount,
        success_count: (previousFeedback?.success_count ?? 0) + (entry.success ? 1 : 0),
        failure_count: (previousFeedback?.failure_count ?? 0) + (entry.success ? 0 : 1),
        last_outcome: entry.success ? 'success' : 'failure',
        last_task_id: entry.taskId,
        last_assigned_agent: entry.assignedAgent,
        last_duration_ms: entry.durationMs,
        last_seen: now,
      };

      if (signal.observation_stats) {
        const delta = entry.success
          ? FEEDBACK_SUCCESS_CONFIDENCE_BOOST
          : -FEEDBACK_FAILURE_CONFIDENCE_PENALTY;
        const next = Math.max(
          FEEDBACK_MIN_CONFIDENCE,
          Math.min(1, signal.observation_stats.avg_confidence + delta),
        );
        signal.observation_stats = {
          ...signal.observation_stats,
          avg_confidence: next,
          last_seen: now,
        };
      }

      results.push({
        signalName,
        previousAvgConfidence: previousAvg,
        updatedAvgConfidence: signal.observation_stats?.avg_confidence ?? null,
        feedbackStats: signal.feedback_stats,
      });
    }

    if (results.length > 0) {
      this.save(data);
    }

    return results;
  }

  private createEmptyFile(): CuratedSignalsFile {
    return {
      description: 'Curated high-signal primitives for Repertoire',
      schema_version: '1.1',
      last_updated: new Date().toISOString(),
      signals: [],
    };
  }
}