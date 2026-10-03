import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CuratedSignalsManager } from '../registry/CuratedSignalsManager.js';
import { SignalInjector } from './signal-injector.js';

describe('SignalInjector.buildSynthesisContext', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it('collocates synthesis primitive, codex excerpt, and plan state', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-synth-'));
    const signalsPath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(signalsPath);
    manager.addSignal({
      name: 'synthesis',
      definition: 'Periodic reflect-and-realign checkpoint.',
      tags: ['checkpoint', 'coherence', 'orchestration'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Completes synthesis checkpoint via analyze-complexity.',
      validation_experiment: 'Enable synthesis gate and verify deny/clear cycle.',
      master_index_integration: 'Orchestration primitive.',
      implementation_notes: '0xRay delegation-gate + Repertoire context builder.',
    });

    mkdirSync(join(tempDir, '.xray', 'state'), { recursive: true });
    writeFileSync(
      join(tempDir, '.xray', 'codex.json'),
      JSON.stringify({
        terms: [
          { id: 59, title: 'Complex work requires orchestrator intake' },
          { id: 67, title: 'Best subagents for task type' },
        ],
      }),
    );
    writeFileSync(
      join(tempDir, '.xray', 'state', 'lead-dev-plan.json'),
      JSON.stringify({
        active: true,
        phases: [
          {
            id: 'phase-1',
            name: 'Synthesis',
            todos: [{ id: '1.1', task: 'reflect and realign', status: 'pending', subagent: 'orchestrator' }],
          },
        ],
      }),
    );

    mkdirSync(join(tempDir, 'logs/meta-inference'), { recursive: true });
    writeFileSync(
      join(tempDir, 'logs/meta-inference/synthesis.md'),
      '# Synthesis\n\n## 5. Strategic Recommendations\n- Add consult receipt gate\n',
    );

    const injector = new SignalInjector(manager, tempDir);
    const ctx = injector.buildSynthesisContext(tempDir);

    expect(ctx.primitive).toBe('synthesis');
    expect(ctx.matchedSignals.some((s) => s.name === 'synthesis')).toBe(true);
    expect(ctx.codexTermCount).toBe(2);
    expect(ctx.codexExcerpt).toContain('59.');
    expect(ctx.planExcerpt).toContain('phase-1');
    expect(ctx.collatedText).toContain('Synthesis checkpoint');
    expect(ctx.collatedText).toContain('synthesis');
    expect(ctx.synthesisExcerpt).toContain('consult receipt gate');
  });

  it('with only dry-synthesis.md present, synthesisExcerpt is absent and routing gets nothing from it', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'repertoire-dry-synth-'));
    const signalsPath = join(tempDir, 'curated_signals.json');
    const manager = new CuratedSignalsManager(signalsPath);
    manager.addSignal({
      name: 'synthesis',
      definition: 'Periodic reflect-and-realign checkpoint.',
      tags: ['checkpoint'],
      priority: 'high',
      status: 'validated',
      evaluation_criteria: 'Completes synthesis checkpoint.',
      validation_experiment: 'Enable synthesis gate.',
      master_index_integration: 'Orchestration primitive.',
      implementation_notes: 'Dry reports stay out of routing.',
    });

    mkdirSync(join(tempDir, 'logs/meta-inference'), { recursive: true });
    const token = 'DRY_ONLY_TOKEN_MUST_NOT_ROUTE';
    writeFileSync(
      join(tempDir, 'logs/meta-inference/dry-synthesis.md'),
      `# UNREVIEWED Dry Synthesis Report (no Hermes — OAuth unavailable)\n\n## 5. Strategic Recommendations\n- ${token}\n`,
    );

    const injector = new SignalInjector(manager, tempDir);
    const ctx = injector.buildSynthesisContext(tempDir);
    expect(ctx.synthesisExcerpt).toBeUndefined();
    expect(ctx.collatedText).not.toContain(token);

    const inherited = injector.buildInheritedContext([
      { id: 't1', description: 'reflect and realign', type: 'synthesis' },
    ]);
    expect(inherited.synthesisExcerpt).toBeUndefined();

    const routing = injector.buildRoutingContext('synthesis checkpoint');
    expect(routing.synthesisAvailable).toBe(false);
    const tasks = injector.matchSignalsForTasks([
      { id: 't1', description: 'reflect and realign', type: 'synthesis' },
    ]);
    expect(tasks[0]?.metadata?.synthesisContext).toBeUndefined();
    expect(JSON.stringify(tasks)).not.toContain(token);
    expect(JSON.stringify(routing)).not.toContain(token);
  });
});