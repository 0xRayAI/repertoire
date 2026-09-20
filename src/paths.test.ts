import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNALS_PATH,
  defaultProjectStateDir,
  hydrateWritableSignals,
  isFactorySeedFile,
  isImmutablePackagePath,
  isRepertoirePackageCwd,
  resolveWritableConfigPath,
} from './paths.js';

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
