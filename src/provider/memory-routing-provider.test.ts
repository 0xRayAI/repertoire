import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createMemoryRoutingProvider,
  resolveProviderConfigPath,
} from './memory-routing-provider.js';
import { DEFAULT_SIGNALS_PATH } from '../paths.js';

describe('memory-routing-provider path resolution', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-provider-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('resolveProviderConfigPath falls back to package default when consumer path is wrong', () => {
    const resolved = resolveProviderConfigPath(
      '../nonexistent/curated_signals.json',
      tmp,
      DEFAULT_SIGNALS_PATH,
    );
    expect(resolved).toBe(DEFAULT_SIGNALS_PATH);
  });

  it('isAvailable uses package signals when consumer-relative path is missing', () => {
    const provider = createMemoryRoutingProvider({
      signalsPath: join(tmp, 'wrong', 'curated_signals.json'),
    });
    const status = (provider as { getAvailabilityStatus(): { available: boolean; reason: string; signalCount: number } })
      .getAvailabilityStatus();
    expect(status.available).toBe(true);
    expect(status.reason).toBe('ok');
    expect(status.signalCount).toBeGreaterThan(0);
  });

  it('ingestFeedback from a consumer cwd does not mutate the package seed', () => {
    const consumer = mkdtempSync(join(tmpdir(), 'repertoire-consumer-cwd-'));
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'demo-app' }));
    const seedBefore = readFileSync(DEFAULT_SIGNALS_PATH, 'utf8');
    const provider = createMemoryRoutingProvider({ projectRoot: consumer });
    provider.ingestFeedback?.({
      timestamp: new Date().toISOString(),
      sessionId: 's1',
      taskId: 't1',
      assignedAgent: 'station',
      memorySignals: ['attestation-as-map'],
      complexity: 0,
      success: true,
      durationMs: 1,
    });
    expect(readFileSync(DEFAULT_SIGNALS_PATH, 'utf8')).toBe(seedBefore);
    const copy = join(consumer, '.xray', 'state', 'repertoire', 'curated_signals.json');
    expect(readFileSync(copy, 'utf8').length).toBeGreaterThan(0);
    rmSync(consumer, { recursive: true, force: true });
  });

  it('reports empty_registry when signals file exists but has no entries', () => {
    const emptyDir = join(tmp, 'empty-data');
    mkdirSync(emptyDir, { recursive: true });
    const emptyPath = join(emptyDir, 'curated_signals.json');
    writeFileSync(
      emptyPath,
      JSON.stringify({ signals: [], schema_version: '1.1' }),
    );
    const provider = createMemoryRoutingProvider({ signalsPath: emptyPath });
    const status = (provider as { getAvailabilityStatus(): { available: boolean; reason: string } })
      .getAvailabilityStatus();
    expect(status.available).toBe(false);
    expect(status.reason).toBe('empty_registry');
  });
});