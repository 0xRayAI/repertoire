import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverSiblingRepos,
  discoverXrayKernelDirs,
  reloadOpProc,
  shouldAutoSyncXray,
} from './paths.js';
import {
  isFieldPrimitiveName,
  repoPrimitiveName,
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
        'Continue this card. Compaction and host change are the same cut. Station survives. Repertoire is the long-running KB.',
    });
    expect(conf.matchedSignals).toEqual(
      expect.arrayContaining(['station-survives-the-cut', 'repertoire-is-long-running-kb']),
    );
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
    const result = service.ingestXraySessions(sourceDir);
    expect(result.imported).toBe(1);
    expect(
      service.signalsManager.getByName('station-survives-the-cut')?.observation_stats?.observation_count,
    ).toBeGreaterThan(0);
    const conf = service.getTaskConfidence({
      description: 'Continue this card. Compaction and host change are the same cut.',
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
    expect(dest.signals.map((signal) => signal.name)).toEqual(expect.arrayContaining(snap.names));
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
    const seat = join(tmp, 'repertoire');
    mkdirSync(seat);
    writeFileSync(join(seat, 'package.json'), JSON.stringify({ name: '@0xray/repertoire' }));
    const siblings = discoverSiblingRepos(seat);
    expect(siblings.map((s) => s.primitive)).toEqual(
      expect.arrayContaining(['repo-xray', 'repo-clearing', 'repo-repertoire']),
    );
  });
});
