import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectKernelDiaryText,
  discoverSiblingRepos,
  discoverXrayKernelDirs,
  reloadOpProc,
  shouldAutoSyncXray,
} from './paths.js';
import {
  isFieldPrimitiveName,
  repoPrimitiveName,
  signalNameInText,
  slugFieldPrimitiveName,
} from './registry/CuratedSignalsManager.js';
import { RepertoireService } from './RepertoireService.js';

describe('kernel memory + OP-PROC reload', () => {
  let tmp = '';

  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('slugs session patterns and refuses heading dumps', () => {
    expect(slugFieldPrimitiveName('Extract Method')).toBe('extract-method');
    expect(repoPrimitiveName('@0xray/repertoire')).toBe('repo-repertoire');
    expect(repoPrimitiveName('0xray', 'xray')).toBe('repo-xray');
    expect(repoPrimitiveName('vite_react_shadcn_ts', 'chrono-warp-drive')).toBe(
      'repo-chrono-warp-drive',
    );
    expect(isFieldPrimitiveName('criteria_selection_gap')).toBe(false);
    expect(isFieldPrimitiveName('repo-xray')).toBe(true);
    expect(slugFieldPrimitiveName('7-final-statement')).toBe(null);
    expect(slugFieldPrimitiveName('phase-3-exhaustive-code-digestion')).toBe(null);
  });

  it('grows dest from 0xRay session-capture and heats overlay OP-PROC', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-xray-session-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const sourceDir = join(tmp, 'docs', 'inference');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'session-2026-09-21.json'),
      JSON.stringify({
        sessionId: 'session-kernel-1',
        timestamp: '2026-09-21T08:00:00.000Z',
        problems: ['Station is cascade. Repertoire is the long-running KB after compact.'],
        solutions: ['Read dest overlay names. Do not encode OP-PROC onto Station.'],
        patterns: [
          { name: 'Extract Method', description: 'session-capture producer', confidence: 0.8 },
        ],
      }),
    );

    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    const result = service.ingestXraySessions(sourceDir);
    expect(result.imported).toBe(1);
    expect(service.signalsManager.getByName('extract-method')?.observation_stats?.observation_count).toBe(
      1,
    );
    expect(service.stateManager.isProcessed('session-kernel-1')).toBe(true);

    const conf = service.getTaskConfidence({
      description:
        'Continue this card. station-survives-the-cut. repertoire-is-long-running-kb.',
    });
    expect(conf.matchedSignals).toEqual(
      expect.arrayContaining(['station-survives-the-cut', 'repertoire-is-long-running-kb']),
    );
    const unnamed = service.getTaskConfidence({
      description: 'Station survives. Repertoire is the long-running KB.',
    });
    expect(unnamed.matchedSignals).not.toContain('station-survives-the-cut');
    expect(unnamed.matchedSignals).not.toContain('repertoire-is-long-running-kb');
  });

  it('heats overlay names from Cursor heat approaches', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-xray-approaches-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const sourceDir = join(tmp, 'docs', 'inference');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, 'session-heat.json'),
      JSON.stringify({
        sessionId: 'session-heat-approaches',
        timestamp: '2026-09-21T20:00:00.000Z',
        approaches: [
          'station-survives-the-cut heat',
          'compact-rekey-from-disk',
        ],
      }),
    );

    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    const before = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    const result = service.ingestXraySessions(sourceDir);
    expect(result.imported).toBe(1);
    const after = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(after?.observation_count).toBe(before?.observation_count);
    expect(after?.avg_confidence).toBe(before?.avg_confidence);
    const conf = service.getTaskConfidence({
      description: 'Continue this card. station-survives-the-cut. Compaction and host change are the same cut.',
    });
    expect(conf.matchedSignals).toEqual(expect.arrayContaining(['station-survives-the-cut']));
  });

  it('discoverXrayKernelDirs skips Groover experiment dirs', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-xray-discover-'));
    const groover = join(tmp, 'research', 'groover-inference-logs', 'docs', 'inference');
    const real = join(tmp, 'docs', 'inference');
    mkdirSync(groover, { recursive: true });
    mkdirSync(real, { recursive: true });
    writeFileSync(
      join(groover, 'session-nope.json'),
      JSON.stringify({ sessionId: 'g', timestamp: '2026-09-21T00:00:00.000Z' }),
    );
    writeFileSync(
      join(real, 'session-yes.json'),
      JSON.stringify({ sessionId: 'x', timestamp: '2026-09-21T00:00:00.000Z' }),
    );
    expect(discoverXrayKernelDirs(tmp)).toEqual([real]);
    const prev = process.env.REPERTOIRE_XRAY_LOGS;
    process.env.REPERTOIRE_XRAY_LOGS = groover;
    try {
      expect(discoverXrayKernelDirs(join(tmp, 'empty'))).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.REPERTOIRE_XRAY_LOGS;
      else process.env.REPERTOIRE_XRAY_LOGS = prev;
    }
  });

  it('reloadOpProc hydrates overlay names and does not use Station', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-op-proc-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const snap = reloadOpProc(tmp);
    expect(snap.count).toBeGreaterThanOrEqual(37);
    expect(snap.names).toEqual(
      expect.arrayContaining([
        'attestation-as-map',
        'station-survives-the-cut',
        'repertoire-is-long-running-kb',
        'compact-rekey-from-disk',
        'groover-is-not-repertoire',
      ]),
    );
    expect(snap.dest).toContain('.xray/state/repertoire/curated_signals.json');
    const dest = JSON.parse(readFileSync(snap.dest, 'utf8')) as { signals: Array<{ name: string }> };
    const destNames = dest.signals.map((signal) => signal.name);
    expect(destNames).toEqual(expect.arrayContaining(snap.names));
    expect(destNames).toContain('repo-clearing');
    expect(snap.names).not.toContain('repo-clearing');
  });

  it('routes x402 on a dest sitting on the float 0.55 floor', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-float-gate-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    const destPath = service.signalsManager.filePath;
    const dest = JSON.parse(readFileSync(destPath, 'utf8')) as {
      signals: Array<{ name: string; observation_stats?: { avg_confidence: number } }>;
    };
    for (const signal of dest.signals) {
      if (signal.observation_stats) {
        signal.observation_stats.avg_confidence = 0.5499999999999999;
      }
    }
    writeFileSync(destPath, `${JSON.stringify(dest, null, 2)}\n`);
    const conf = service.getTaskConfidence({
      description: 'Pay only live x402 services. repo-clearing. Never double-pay. Receipted URL extract catalog.',
    });
    expect(conf.matchedSignals).toEqual(expect.arrayContaining(['repo-clearing']));
  });

  it('matches subject flesh after hydrate and does not treat it as OP-PROC', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-subject-route-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    expect(service.signalsManager.getByName('repo-clearing')?.definition).toMatch(/x402/);
    const conf = service.getTaskConfidence({
      description: 'Pay only live x402 services. repo-clearing. Never double-pay. Receipted URL extract catalog.',
    });
    expect(conf.matchedSignals).toEqual(expect.arrayContaining(['repo-clearing']));
    expect(service.reloadOpProc().names).not.toContain('repo-clearing');
  });

  it('records a session sample at the source confidence and skips a weaker score', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-weak-score-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    const sourceDir = join(tmp, 'docs', 'inference');
    mkdirSync(sourceDir, { recursive: true });
    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    const destPath = service.signalsManager.filePath;
    const dest = JSON.parse(readFileSync(destPath, 'utf8')) as {
      signals: Array<{
        name: string;
        observation_stats?: { observation_count: number; avg_confidence: number; last_seen: string };
      }>;
    };
    const station = dest.signals.find((signal) => signal.name === 'station-survives-the-cut');
    if (!station) throw new Error('station-survives-the-cut missing from dest');
    station.observation_stats = {
      observation_count: 4,
      avg_confidence: 0.61,
      last_seen: '2026-01-01T00:00:00.000Z',
    };
    writeFileSync(destPath, `${JSON.stringify(dest, null, 2)}\n`);

    writeFileSync(
      join(sourceDir, 'session-weak.json'),
      JSON.stringify({
        sessionId: 'session-weak-score',
        timestamp: '2026-09-22T08:00:00.000Z',
        patterns: [{ name: 'station-survives-the-cut', confidence: 0.2 }],
      }),
    );
    service.ingestXraySessions(sourceDir);
    const skipped = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(skipped?.observation_count).toBe(4);
    expect(skipped?.avg_confidence).toBe(0.61);

    writeFileSync(
      join(sourceDir, 'session-real.json'),
      JSON.stringify({
        sessionId: 'session-real-score',
        timestamp: '2026-09-22T09:00:00.000Z',
        patterns: [
          { name: 'station-survives-the-cut', confidence: 0.8 },
          { name: 'fresh-field-primitive', confidence: 0.4 },
          { name: 'kept-field-primitive', confidence: 0.8 },
        ],
      }),
    );
    service.ingestXraySessions(sourceDir);
    const recorded = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(recorded?.observation_count).toBe(5);
    expect(recorded?.avg_confidence).toBeCloseTo((0.61 * 4 + 0.8) / 5, 5);
    expect(service.signalsManager.getByName('fresh-field-primitive')).toBeUndefined();
    expect(service.signalsManager.getByName('kept-field-primitive')?.observation_stats?.observation_count).toBe(
      1,
    );
    expect(service.signalsManager.getByName('kept-field-primitive')?.observation_stats?.avg_confidence).toBe(0.8);

    writeFileSync(
      join(sourceDir, 'session-below-gate.json'),
      JSON.stringify({
        sessionId: 'session-below-gate',
        timestamp: '2026-09-22T10:00:00.000Z',
        patterns: [
          { name: 'station-survives-the-cut', confidence: 0.4 },
          { name: 'kept-field-primitive', confidence: 0.4 },
        ],
      }),
    );
    service.ingestXraySessions(sourceDir);
    const below = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(below?.observation_count).toBe(5);
    expect(below?.avg_confidence).toBeCloseTo((0.61 * 4 + 0.8) / 5, 5);
    expect(service.signalsManager.getByName('kept-field-primitive')?.observation_stats?.observation_count).toBe(
      1,
    );

    writeFileSync(
      join(sourceDir, 'session-at-gate.json'),
      JSON.stringify({
        sessionId: 'session-at-gate',
        timestamp: '2026-09-22T11:00:00.000Z',
        patterns: [{ name: 'gate-field-primitive', confidence: 0.55 }],
      }),
    );
    service.ingestXraySessions(sourceDir);
    const gated = service.signalsManager.getByName('gate-field-primitive')?.observation_stats;
    expect(gated?.observation_count).toBe(1);
    expect(gated?.avg_confidence).toBe(0.55);
    expect(service.signalsManager.getByName('station-survives-the-cut')?.observation_stats?.observation_count).toBe(
      5,
    );
  });

  it('heats existing dest names from kernel diary and does not propose colon ids', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-kernel-diary-'));
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ name: 'consumer-app' }));
    mkdirSync(join(tmp, 'logs', 'framework'), { recursive: true });
    writeFileSync(
      join(tmp, 'logs', 'framework', 'activity.log'),
      [
        'Continue this card. Compaction and host change are the same cut.',
        'Pay only live x402 services. Catalog hangar.',
        'architect:architect_skill should stay out of dest.',
      ].join('\n'),
    );
    const diary = collectKernelDiaryText(tmp);
    expect(diary.sources.some((source) => source.endsWith('activity.log'))).toBe(true);
    const service = new RepertoireService({
      projectRoot: tmp,
      syncField: false,
      syncXray: false,
    });
    const destPath = service.signalsManager.filePath;
    const dest = JSON.parse(readFileSync(destPath, 'utf8')) as {
      signals: Array<{
        name: string;
        observation_stats?: { observation_count: number; avg_confidence: number; last_seen: string };
      }>;
    };
    const station = dest.signals.find((signal) => signal.name === 'station-survives-the-cut');
    const unnamed = dest.signals.find((signal) => signal.name === 'jelly-is-dormant');
    if (!station || !unnamed) {
      throw new Error('expected dest names missing');
    }
    station.observation_stats = {
      observation_count: 4,
      avg_confidence: 0.61,
      last_seen: '2026-01-01T00:00:00.000Z',
    };
    unnamed.observation_stats = {
      observation_count: 3,
      avg_confidence: 0.7,
      last_seen: '2026-01-02T00:00:00.000Z',
    };
    writeFileSync(destPath, `${JSON.stringify(dest, null, 2)}\n`);

    const quiet = service.heatKernelDiary(diary);
    expect(quiet.heated).toContain('station-survives-the-cut');
    expect(quiet.heated).not.toContain('jelly-is-dormant');
    expect(quiet.heated).not.toContain('repo-clearing');
    const clauseTouch = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(clauseTouch?.observation_count).toBe(4);
    expect(clauseTouch?.avg_confidence).toBe(0.61);
    expect(clauseTouch?.last_seen).not.toBe('2026-01-01T00:00:00.000Z');
    const unnamedQuiet = service.signalsManager.getByName('jelly-is-dormant')?.observation_stats;
    expect(unnamedQuiet?.observation_count).toBe(3);
    expect(unnamedQuiet?.avg_confidence).toBe(0.7);
    expect(unnamedQuiet?.last_seen).toBe('2026-01-02T00:00:00.000Z');

    const namedDiary = {
      text: `${diary.text}\nstation-survives-the-cut`,
      sources: diary.sources,
    };
    const heated = service.heatKernelDiary(namedDiary);
    expect(heated.heated).toContain('station-survives-the-cut');
    expect(heated.heated).not.toContain('jelly-is-dormant');
    expect(service.signalsManager.getByName('architect-architect-skill')).toBeUndefined();
    const once = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(once?.observation_count).toBe(4);
    expect(once?.avg_confidence).toBe(0.61);
    expect(once?.last_seen).not.toBe('2026-01-01T00:00:00.000Z');
    const unnamedOnce = service.signalsManager.getByName('jelly-is-dormant')?.observation_stats;
    expect(unnamedOnce?.last_seen).toBe('2026-01-02T00:00:00.000Z');
    expect(unnamedOnce?.observation_count).toBe(3);
    expect(unnamedOnce?.avg_confidence).toBe(0.7);
    service.heatKernelDiary(namedDiary);
    const twice = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(twice?.observation_count).toBe(4);
    expect(twice?.avg_confidence).toBe(0.61);
    const unnamedTwice = service.signalsManager.getByName('jelly-is-dormant')?.observation_stats;
    expect(unnamedTwice?.observation_count).toBe(3);
    expect(unnamedTwice?.avg_confidence).toBe(0.7);
    expect(unnamedTwice?.last_seen).toBe('2026-01-02T00:00:00.000Z');

    const definition = service.signalsManager.getByName('station-survives-the-cut')?.definition ?? '';
    const longWords = definition
      .toLowerCase()
      .split(/[^\w.]+/)
      .filter((word) => word.length > 5 && !word.includes('station'));
    expect(longWords.length).toBeGreaterThanOrEqual(2);
    const twoWords = longWords.slice(0, 2).join(' ');
    expect(signalNameInText(twoWords, 'station-survives-the-cut')).toBe(false);
    expect(signalNameInText('clearing', 'repo-clearing')).toBe(false);
    expect(signalNameInText('heat conviction', 'heat-is-not-conviction')).toBe(false);
    expect(signalNameInText('heat is not conviction', 'heat-is-not-conviction')).toBe(true);
    const beforeWords = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    const missed = service.heatKernelDiary({ text: twoWords, sources: ['definition-words'] });
    expect(missed.heated).not.toContain('station-survives-the-cut');
    const afterWords = service.signalsManager.getByName('station-survives-the-cut')?.observation_stats;
    expect(afterWords?.observation_count).toBe(beforeWords?.observation_count);
    expect(afterWords?.avg_confidence).toBe(beforeWords?.avg_confidence);
    expect(afterWords?.last_seen).toBe(beforeWords?.last_seen);
    const dormantAfterWords = service.signalsManager.getByName('jelly-is-dormant')?.observation_stats;
    expect(dormantAfterWords?.last_seen).toBe('2026-01-02T00:00:00.000Z');
    expect(dormantAfterWords?.observation_count).toBe(3);
  });

  it('fleshes generic sibling stubs from package.json without overwriting subject overlay', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-flesh-sibling-'));
    mkdirSync(join(tmp, 'xray'));
    mkdirSync(join(tmp, 'clearing'));
    writeFileSync(
      join(tmp, 'xray', 'package.json'),
      JSON.stringify({ name: '0xray', description: 'live suit exo description from package.json' }),
    );
    writeFileSync(
      join(tmp, 'clearing', 'package.json'),
      JSON.stringify({ name: 'clearing', description: 'should not overwrite overlay x402 flesh' }),
    );
    const seat = join(tmp, 'repertoire');
    mkdirSync(seat);
    writeFileSync(join(seat, 'package.json'), JSON.stringify({ name: '@0xray/repertoire' }));
    const service = new RepertoireService({
      projectRoot: seat,
      syncField: false,
      syncXray: false,
    });
    const extra = join(tmp, 'scout');
    mkdirSync(extra);
    writeFileSync(
      join(extra, 'package.json'),
      JSON.stringify({ name: 'brand-new-hangar-xyz', description: 'brand new hangar from package.json' }),
    );
    const result = service.syncWorkspaceRepos();
    expect(service.signalsManager.getByName('repo-clearing')?.definition).toMatch(/x402/);
    expect(service.signalsManager.getByName('repo-xray')?.definition).toMatch(/Three-subsystem OS/);
    expect(result.observed).toEqual(expect.arrayContaining(['repo-brand-new-hangar-xyz']));
    expect(service.signalsManager.getByName('repo-brand-new-hangar-xyz')?.definition).toBe(
      'brand new hangar from package.json',
    );
  });

  it('constructing the organ does not append workspace samples', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-construct-workspace-'));
    mkdirSync(join(tmp, 'scout'));
    writeFileSync(
      join(tmp, 'scout', 'package.json'),
      JSON.stringify({ name: 'brand-new-hangar-xyz', description: 'brand new hangar from package.json' }),
    );
    const seat = join(tmp, 'repertoire');
    mkdirSync(seat);
    writeFileSync(join(seat, 'package.json'), JSON.stringify({ name: '@0xray/repertoire' }));
    const service = new RepertoireService({
      projectRoot: seat,
      syncField: false,
      syncXray: true,
    });
    expect(service.signalsManager.getByName('repo-brand-new-hangar-xyz')).toBeUndefined();
    const explicit = service.syncWorkspaceRepos();
    expect(explicit.observed).toEqual(expect.arrayContaining(['repo-brand-new-hangar-xyz']));
    expect(
      service.signalsManager.getByName('repo-brand-new-hangar-xyz')?.observation_stats?.avg_confidence,
    ).toBe(0.55);
  });

  it('shouldAutoSyncXray stays off under Vitest unless forced', () => {
    expect(shouldAutoSyncXray()).toBe(false);
    expect(shouldAutoSyncXray(true)).toBe(true);
    expect(shouldAutoSyncXray(false)).toBe(false);
  });

  it('maps sibling package.json names when the parent looks like this workspace', () => {
    tmp = mkdtempSync(join(tmpdir(), 'repertoire-siblings-'));
    mkdirSync(join(tmp, 'xray'));
    mkdirSync(join(tmp, 'clearing'));
    writeFileSync(join(tmp, 'xray', 'package.json'), JSON.stringify({ name: '0xray', description: 'suit exo' }));
    writeFileSync(
      join(tmp, 'clearing', 'package.json'),
      JSON.stringify({ name: 'clearing', description: 'x402 hangar' }),
    );
    mkdirSync(join(tmp, 'chrono-warp-drive'));
    writeFileSync(
      join(tmp, 'chrono-warp-drive', 'package.json'),
      JSON.stringify({ name: 'vite_react_shadcn_ts', description: 'temporal seat' }),
    );
    const seat = join(tmp, 'repertoire');
    mkdirSync(seat);
    writeFileSync(join(seat, 'package.json'), JSON.stringify({ name: '@0xray/repertoire' }));
    const siblings = discoverSiblingRepos(seat);
    expect(siblings.map((s) => s.primitive)).toEqual(
      expect.arrayContaining([
        'repo-xray',
        'repo-clearing',
        'repo-repertoire',
        'repo-chrono-warp-drive',
      ]),
    );
    expect(siblings.map((s) => s.primitive)).not.toContain('repo-vite-react-shadcn-ts');
  });
});
