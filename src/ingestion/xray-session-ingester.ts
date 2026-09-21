import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CuratedSignalsManager,
  DEFAULT_PROMOTION_MIN_CONFIDENCE,
  isFieldPrimitiveName,
  slugFieldPrimitiveName,
} from '../registry/CuratedSignalsManager.js';
import { InferenceStateManager } from '../registry/InferenceStateManager.js';
import { defaultWritablePaths } from '../paths.js';
import type { InferenceEntry, PrimitiveMatch } from '../types.js';

export interface XraySessionPattern {
  type?: string;
  name?: string;
  description?: string;
  confidence?: number;
}

export interface XraySessionFile {
  sessionId: string;
  timestamp: string;
  problems?: string[];
  approaches?: string[];
  wrongTurns?: string[];
  solutions?: string[];
  patterns?: XraySessionPattern[];
  matched_primitives?: string[];
  match_confidence?: Record<string, number>;
}

export interface XraySessionIngesterOptions {
  sourceDir: string;
  targetDir?: string;
  signalsManager?: CuratedSignalsManager;
  stateManager?: InferenceStateManager;
  repoPrimitive?: string;
}

export interface XraySessionIngestResult {
  imported: number;
  skipped: number;
  promoted: string[];
}

export class XraySessionIngester {
  private readonly sourceDir: string;
  private readonly targetDir: string;
  private readonly signalsManager: CuratedSignalsManager;
  private readonly stateManager: InferenceStateManager | undefined;
  private readonly repoPrimitive: string | undefined;

  constructor(options: XraySessionIngesterOptions) {
    this.sourceDir = options.sourceDir;
    this.targetDir = options.targetDir ?? defaultWritablePaths().logDir;
    this.signalsManager = options.signalsManager ?? new CuratedSignalsManager();
    this.stateManager = options.stateManager;
    this.repoPrimitive = options.repoPrimitive;
  }

  ingest(): XraySessionIngestResult {
    if (!existsSync(this.sourceDir)) {
      return { imported: 0, skipped: 0, promoted: [] };
    }

    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }

    const existingIds = this.loadExistingSessionIds();
    let imported = 0;
    let skipped = 0;

    const files = readdirSync(this.sourceDir).filter(
      (f) => f.startsWith('session-') && f.endsWith('.json'),
    );

    for (const file of files) {
      try {
        const session = JSON.parse(
          readFileSync(join(this.sourceDir, file), 'utf8'),
        ) as XraySessionFile;

        if (!session.sessionId || existingIds.has(session.sessionId)) {
          skipped++;
          continue;
        }

        const entry = this.sessionToInferenceEntry(session);
        const targetFile = join(this.targetDir, `${session.timestamp.split('T')[0]}.jsonl`);
        appendFileSync(targetFile, JSON.stringify(entry) + '\n');
        this.recordObservations(session, entry);
        if (this.stateManager && session.sessionId) {
          this.stateManager.markProcessed([session.sessionId], 'session');
        }

        existingIds.add(session.sessionId);
        imported++;
      } catch {
        skipped++;
      }
    }

    const promoted = imported > 0 ? this.signalsManager.promoteQualifiedSignals() : [];
    return { imported, skipped, promoted };
  }

  private recordObservations(session: XraySessionFile, entry: InferenceEntry): void {
    const matches = this.extractMatches(session, entry);
    if (matches.length === 0) return;
    this.signalsManager.recordPrimitiveObservations(matches);
  }

  private extractMatches(session: XraySessionFile, entry: InferenceEntry): PrimitiveMatch[] {
    const matches: PrimitiveMatch[] = [];
    const seen = new Set<string>();
    const add = (name: string, confidence: number) => {
      if (seen.has(name) || !isFieldPrimitiveName(name)) return;
      if (confidence < DEFAULT_PROMOTION_MIN_CONFIDENCE) return;
      seen.add(name);
      matches.push({ name, confidence });
    };

    for (const pattern of session.patterns ?? []) {
      const raw = pattern.name || pattern.type || '';
      const slug = slugFieldPrimitiveName(raw);
      const confidence =
        typeof pattern.confidence === 'number' ? pattern.confidence : DEFAULT_PROMOTION_MIN_CONFIDENCE;
      if (slug) add(slug, Math.max(confidence, DEFAULT_PROMOTION_MIN_CONFIDENCE));
    }

    for (const name of session.matched_primitives ?? []) {
      const confidence = session.match_confidence?.[name] ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
      add(name, confidence);
    }

    if (this.repoPrimitive) {
      add(this.repoPrimitive, DEFAULT_PROMOTION_MIN_CONFIDENCE);
    }

    for (const hit of this.signalsManager.matchByText(entry.inference, 2)) {
      add(hit.signal.name, DEFAULT_PROMOTION_MIN_CONFIDENCE);
    }

    return matches;
  }

  private sessionToInferenceEntry(session: XraySessionFile): InferenceEntry {
    const inferenceParts = [
      `Session: ${session.sessionId}`,
      session.problems?.length ? `Problems: ${session.problems.join('; ')}` : '',
      session.approaches?.length ? `Approaches: ${session.approaches.join('; ')}` : '',
      session.wrongTurns?.length ? `Wrong turns: ${session.wrongTurns.join('; ')}` : '',
      session.solutions?.length ? `Solutions: ${session.solutions.join('; ')}` : '',
      session.patterns?.length
        ? `Patterns: ${session.patterns
            .map((p) => `${p.name || p.type || 'pattern'}: ${p.description ?? ''}`)
            .join('; ')}`
        : '',
    ].filter(Boolean);

    const inference = inferenceParts.join('\n');

    return {
      timestamp: session.timestamp,
      source: 'xray',
      session_id: session.sessionId,
      inference,
      matched_primitives: session.matched_primitives,
      match_confidence: session.match_confidence,
    };
  }

  private loadExistingSessionIds(): Set<string> {
    const ids = new Set<string>();
    if (!existsSync(this.targetDir)) return ids;

    for (const file of readdirSync(this.targetDir).filter((f) => f.endsWith('.jsonl'))) {
      const lines = readFileSync(join(this.targetDir, file), 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const e = JSON.parse(line) as InferenceEntry;
          if (e.session_id) ids.add(e.session_id);
        } catch {
          // skip
        }
      }
    }
    return ids;
  }
}
