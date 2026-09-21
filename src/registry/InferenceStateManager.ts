import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { InferenceState } from '../types.js';

export class InferenceStateManager {
  constructor(private readonly filePath = 'data/inference-state.json') {}

  load(): InferenceState {
    if (!existsSync(this.filePath)) {
      return this.createEmpty();
    }
    const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<InferenceState>;
    return {
      processedCommentIds: raw.processedCommentIds ?? [],
      processedSessionIds: raw.processedSessionIds ?? [],
      processedPostIds: raw.processedPostIds ?? [],
      lastRun: raw.lastRun ?? null,
    };
  }

  save(state: InferenceState): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2));
  }

  isProcessed(id: string): boolean {
    const state = this.load();
    return (
      state.processedCommentIds.includes(id) ||
      state.processedSessionIds.includes(id) ||
      state.processedPostIds.includes(id)
    );
  }

  markProcessed(ids: string[], kind: 'comment' | 'session' | 'post' = 'comment'): void {
    const state = this.load();
    const target =
      kind === 'comment'
        ? state.processedCommentIds
        : kind === 'session'
          ? state.processedSessionIds
          : state.processedPostIds;
    for (const id of ids) {
      if (!target.includes(id)) target.push(id);
    }
    state.lastRun = new Date().toISOString();
    this.save(state);
  }

  countProcessed(): number {
    const state = this.load();
    return (
      state.processedCommentIds.length +
      state.processedSessionIds.length +
      state.processedPostIds.length
    );
  }

  private createEmpty(): InferenceState {
    return {
      processedCommentIds: [],
      processedSessionIds: [],
      processedPostIds: [],
      lastRun: null,
    };
  }
}