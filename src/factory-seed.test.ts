import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACKAGE_ROOT } from './paths.js';
import { CuratedSignalsManager } from './registry/CuratedSignalsManager.js';
import { createMemoryRoutingProvider } from './provider/memory-routing-provider.js';

describe('factory seed registry', () => {
  const file = JSON.parse(
    readFileSync(join(PACKAGE_ROOT, 'data', 'curated_signals.json'), 'utf8'),
  ) as {
    source: string;
    signals: Array<{ name: string; tags: string[]; priority: string }>;
  };

  it('is a small factory seed, not a plant dump', () => {
    expect(file.source).toBe('factory-seed-4.0');
    expect(file.signals.length).toBeGreaterThanOrEqual(8);
    expect(file.signals.length).toBeLessThanOrEqual(24);
  });

  it('contains routing primitives and no bedrock names', () => {
    const names = file.signals.map((s) => s.name);
    expect(names).toContain('attestation-as-map');
    expect(names).toContain('consumption-boundary-revalidation-gate');
    expect(names).toContain('governance-as-mandatory-external-filter');
    expect(names).toContain('three-subsystem-verifiable-os');
    expect(names.some((n) => n.toLowerCase().startsWith('bedrock'))).toBe(false);
    expect(names.some((n) => n.startsWith('phase-'))).toBe(false);
  });

  it('keeps trap tags for architect routing', () => {
    const traps = file.signals.filter((s) => s.tags.includes('ontological-trap'));
    expect(traps.length).toBeGreaterThan(0);
    expect(traps.every((s) => ['high', 'medium', 'low'].includes(s.priority))).toBe(true);
  });

  it('getTaskConfidence detects a labelled trap against the seed', () => {
    const provider = createMemoryRoutingProvider();
    expect(provider.isAvailable()).toBe(true);
    const conf = provider.getTaskConfidence?.({
      id: 'seed-trap',
      description: 'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation',
      type: 'governance',
    });
    expect(conf?.highConfidenceTrapPresent).toBe(true);
    expect(conf?.recommendedAgent).toBe('architect');
  });

  it('refuses to write the factory seed file', () => {
    const manager = new CuratedSignalsManager(join(PACKAGE_ROOT, 'data', 'curated_signals.json'));
    const seedBefore = readFileSync(join(PACKAGE_ROOT, 'data', 'curated_signals.json'), 'utf8');
    expect(() => manager.save(JSON.parse(seedBefore))).toThrow(/factory seed/);
    expect(readFileSync(join(PACKAGE_ROOT, 'data', 'curated_signals.json'), 'utf8')).toBe(seedBefore);
  });

  it('ingestFeedback from organ cwd does not mutate the tarball seed', () => {
    const seedBefore = readFileSync(join(PACKAGE_ROOT, 'data', 'curated_signals.json'), 'utf8');
    const provider = createMemoryRoutingProvider({ projectRoot: PACKAGE_ROOT });
    provider.ingestFeedback?.({
      timestamp: new Date().toISOString(),
      sessionId: 'seed-hydrate-test',
      taskId: 'seed-hydrate-test',
      assignedAgent: 'architect',
      memorySignals: ['attestation-as-map'],
      complexity: 21,
      success: true,
      durationMs: 1,
    });
    expect(readFileSync(join(PACKAGE_ROOT, 'data', 'curated_signals.json'), 'utf8')).toBe(seedBefore);
  });
});
