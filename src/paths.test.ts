import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DATA_DIR,
  DEFAULT_SIGNALS_PATH,
  DEFAULT_STACK_OVERLAY_PATH,
  defaultProjectStateDir,
  defaultWritablePaths,
  DEFAULT_SUBJECT_OVERLAY_PATH,
  hydrateWritableSignals,
  isFactorySeedFile,
  isImmutablePackagePath,
  isRepertoirePackageCwd,
  mergeStackOverlay,
  mergeSubjectOverlay,
  resolveWritableConfigPath,
} from './paths.js';
import { CuratedSignalsManager } from './registry/CuratedSignalsManager.js';
import { RepertoireService } from './RepertoireService.js';

describe('factory path helpers', () => {
  let tmp = '';

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('treats the package seed as immutable', () => {
    expect(isImmutablePackagePath(DEFAULT_SIGNALS_PATH)).toBe(true);
    expect(isFactorySeedFile(DEFAULT_SIGNALS_PATH)).toBe(true);
    expect(isFactorySeedFile(join(defaultProjectStateDir(process.cwd()), 'curated_signals.json'))).toBe(
      false,
    );
  });

  it('detects this repo as the organ package cwd', () => {
    expect(isRepertoirePackageCwd(process.cwd())).toBe(true);
  });

  it('hydrates a project copy even when cwd is the organ repo', () => {
    const seedBefore = readFileSync(DEFAULT_SIGNALS_PATH, 'utf8');
    const resolved = hydrateWritableSignals(DEFAULT_SIGNALS_PATH, process.cwd());
    expect(resolved).toBe(join(defaultProjectStateDir(process.cwd()), 'curated_signals.json'));
    expect(resolved).not.toBe(DEFAULT_SIGNALS_PATH);
    expect(readFileSync(DEFAULT_SIGNALS_PATH, 'utf8')).toBe(seedBefore);
  });

  it('hydrates a project copy for consumer cwd and leaves the seed unchanged', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-hydrate-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const seedBefore = readFileSync(DEFAULT_SIGNALS_PATH, 'utf8');
    const dest = hydrateWritableSignals(DEFAULT_SIGNALS_PATH, tmp);
    expect(dest).toBe(join(defaultProjectStateDir(tmp), 'curated_signals.json'));
    expect(readFileSync(DEFAULT_SIGNALS_PATH, 'utf8')).toBe(seedBefore);
    const destFile = JSON.parse(readFileSync(dest, 'utf8')) as {
      signals: Array<{ name: string }>;
    };
    const seedFile = JSON.parse(seedBefore) as { signals: Array<{ name: string }> };
    const overlayFile = JSON.parse(readFileSync(DEFAULT_STACK_OVERLAY_PATH, 'utf8')) as {
      signals: Array<{ name: string }>;
    };
    const subjectFile = JSON.parse(readFileSync(DEFAULT_SUBJECT_OVERLAY_PATH, 'utf8')) as {
      signals: Array<{ name: string }>;
    };
    const destNames = destFile.signals.map((signal) => signal.name);
    expect(destNames).toEqual(
      expect.arrayContaining(seedFile.signals.map((signal) => signal.name)),
    );
    expect(destNames).toEqual(
      expect.arrayContaining(overlayFile.signals.map((signal) => signal.name)),
    );
    expect(destNames).toEqual(
      expect.arrayContaining(subjectFile.signals.map((signal) => signal.name)),
    );
    expect(destNames.length).toBe(
      seedFile.signals.length + overlayFile.signals.length + subjectFile.signals.length,
    );
    expect(readFileSync(dest, 'utf8')).not.toBe(seedBefore);
  });

  it('merges overlay additively and does not rewrite existing names', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-overlay-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const dest = hydrateWritableSignals(DEFAULT_SIGNALS_PATH, tmp);
    const first = JSON.parse(readFileSync(dest, 'utf8')) as {
      signals: Array<{ name: string; definition: string }>;
    };
    first.signals.push({
      name: 'seat-local-extra',
      definition: 'A name that lives only on this project copy.',
    });
    writeFileSync(dest, `${JSON.stringify(first, null, 2)}\n`);
    expect(mergeStackOverlay(dest)).toBe(0);
    expect(hydrateWritableSignals(DEFAULT_SIGNALS_PATH, tmp)).toBe(dest);
    const second = JSON.parse(readFileSync(dest, 'utf8')) as {
      signals: Array<{ name: string }>;
    };
    const names = second.signals.map((signal) => signal.name);
    expect(names).toContain('seat-local-extra');
    expect(names).toContain('clean-ticks-every-cycle');
    expect(names.filter((name) => name === 'station-survives-the-cut')).toHaveLength(1);
  });

  it('merges overlay when signalsPath is already the project dest', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-existing-dest-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const dest = join(defaultProjectStateDir(tmp), 'curated_signals.json');
    mkdirSync(join(tmp, '.xray', 'state', 'repertoire'), { recursive: true });
    const seedBefore = readFileSync(DEFAULT_SIGNALS_PATH, 'utf8');
    writeFileSync(dest, seedBefore);
    expect(hydrateWritableSignals(dest, tmp)).toBe(dest);
    const names = (
      JSON.parse(readFileSync(dest, 'utf8')) as { signals: Array<{ name: string }> }
    ).signals.map((signal) => signal.name);
    expect(names).toContain('attestation-as-map');
    expect(names).toContain('repertoire-is-long-running-kb');
    expect(names).toContain('clean-ticks-every-cycle');
    expect(names).toContain('repo-clearing');
    expect(readFileSync(DEFAULT_SIGNALS_PATH, 'utf8')).toBe(seedBefore);
  });

  it('fleshes a generic field-observed stub from subject overlay', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-subject-flesh-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const dest = join(defaultProjectStateDir(tmp), 'curated_signals.json');
    mkdirSync(join(tmp, '.xray', 'state', 'repertoire'), { recursive: true });
    writeFileSync(
      dest,
      JSON.stringify({
        signals: [
          {
            name: 'repo-clearing',
            definition: 'repo clearing. Field-observed domain primitive grown from enriched JSONL. Not the factory seed.',
          },
        ],
      }),
    );
    expect(mergeSubjectOverlay(dest)).toBeGreaterThan(0);
    const clearing = (
      JSON.parse(readFileSync(dest, 'utf8')) as { signals: Array<{ name: string; definition: string }> }
    ).signals.find((signal) => signal.name === 'repo-clearing');
    expect(clearing?.definition).toMatch(/x402/);
    expect(clearing?.definition).not.toMatch(/Field-observed domain primitive/);
  });

  it('refuses to merge overlay onto the factory seed file', () => {
    const seedBefore = readFileSync(DEFAULT_SIGNALS_PATH, 'utf8');
    expect(mergeStackOverlay(DEFAULT_SIGNALS_PATH)).toBe(0);
    expect(readFileSync(DEFAULT_SIGNALS_PATH, 'utf8')).toBe(seedBefore);
  });

  it('defaultWritablePaths stay under project state even in the organ repo', () => {
    const writable = defaultWritablePaths(process.cwd());
    expect(writable.dataDir).toBe(defaultProjectStateDir(process.cwd()));
    expect(writable.dataDir).not.toBe(DEFAULT_DATA_DIR);
    expect(writable.signalsPath).toBe(join(writable.dataDir, 'curated_signals.json'));
    expect(writable.statePath).toBe(join(writable.dataDir, 'inference-state.json'));
    expect(isFactorySeedFile(writable.signalsPath)).toBe(false);
  });

  it('default CuratedSignalsManager hydrates instead of opening the tarball', () => {
    const manager = new CuratedSignalsManager();
    expect(manager.filePath).toBe(join(defaultProjectStateDir(process.cwd()), 'curated_signals.json'));
    expect(isFactorySeedFile(manager.filePath)).toBe(false);
  });

  it('RepertoireService organ-cwd defaults write project state, not package data/', () => {
    const service = new RepertoireService({ projectRoot: process.cwd() });
    const expected = defaultWritablePaths(process.cwd());
    expect(service.signalsManager.filePath).toBe(expected.signalsPath);
    expect(isFactorySeedFile(service.signalsManager.filePath)).toBe(false);
  });

  it('resolveWritableConfigPath does not fall back into the package', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-writable-'));
    const dest = resolveWritableConfigPath(
      '.xray/state/repertoire/inference-state.json',
      tmp,
      DEFAULT_SIGNALS_PATH,
    );
    expect(dest).toBe(join(tmp, '.xray/state/repertoire/inference-state.json'));
    expect(dest).not.toBe(DEFAULT_SIGNALS_PATH);
  });
});
