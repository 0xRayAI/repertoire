import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_DATA_DIR,
  DEFAULT_SIGNALS_PATH,
  defaultProjectStateDir,
  defaultWritablePaths,
  hydrateWritableSignals,
  isFactorySeedFile,
  isImmutablePackagePath,
  isRepertoirePackageCwd,
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
    expect(readFileSync(dest, 'utf8')).toBe(seedBefore);
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
