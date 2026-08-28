#!/usr/bin/env node
/**
 * Run per-bridge suit verify in an isolated consumer directory.
 * Usage: node scripts/run-suit-matrix-consumer.mjs <bridge> <consumerRoot>
 * bridge: grok | hermes | opencode | openclaw
 */
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const bridge = process.argv[2];
const consumerRoot = resolve(process.argv[3] ?? '');
const repertoireRoot = resolve(import.meta.dirname, '..');
const xrayFeatures = join(repertoireRoot, '.xray', 'features.json');

const INSTALL = {
  grok: 'npx 0xray grok install --force',
  hermes: 'npx 0xray hermes install --force',
  opencode: 'npx 0xray opencode install --force',
  openclaw: 'npx 0xray openclaw install --force',
};

const VERIFY = {
  grok: 'verify-grok-suit.mjs',
  hermes: 'verify-hermes-suit.mjs',
  opencode: 'verify-opencode-suit.mjs',
  openclaw: 'verify-openclaw-suit.mjs',
};

if (!bridge || !consumerRoot || !INSTALL[bridge]) {
  console.error('Usage: node run-suit-matrix-consumer.mjs <grok|hermes|opencode|openclaw> <consumerRoot>');
  process.exit(1);
}

const seedFiles = ['features.json', 'codex.json', 'config.json', 'features.schema.json'];
mkdirSync(join(consumerRoot, '.xray'), { recursive: true });
for (const f of seedFiles) {
  const src = join(repertoireRoot, '.xray', f);
  if (existsSync(src)) cpSync(src, join(consumerRoot, '.xray', f));
}
const mcpSrc = join(repertoireRoot, '.mcp.json');
if (existsSync(mcpSrc)) cpSync(mcpSrc, join(consumerRoot, '.mcp.json'));

if (!existsSync(join(consumerRoot, 'package.json'))) {
  writeFileSync(
    join(consumerRoot, 'package.json'),
    JSON.stringify({ name: `suit-test-${bridge}`, private: true, type: 'module' }, null, 2),
  );
}

console.log(`\n═══ Suit consumer test: ${bridge} @ ${consumerRoot} ═══\n`);

execSync('npm install 0xray@3.5.5 @0xray/repertoire@0.1.8 --no-save', {
  cwd: consumerRoot,
  stdio: 'inherit',
});

const pkg = JSON.parse(readFileSync(join(consumerRoot, 'node_modules/0xray/package.json'), 'utf8'));
console.log(`Installed 0xray@${pkg.version}\n`);

execSync(INSTALL[bridge], { cwd: consumerRoot, stdio: 'inherit' });

const verifyScript = join(repertoireRoot, 'scripts', VERIFY[bridge]);
const env = { ...process.env, SUIT_VERIFY_ROOT: consumerRoot };
const result = spawnSync('node', [verifyScript], { cwd: consumerRoot, env, stdio: 'inherit' });

if (bridge === 'grok') {
  const harness = spawnSync(
    'node',
    [join(repertoireRoot, 'scripts', 'confirm-suit-harness.mjs'), '--skip-layer1'],
    { cwd: consumerRoot, env, stdio: 'inherit' },
  );
  if (harness.status !== 0) process.exit(harness.status ?? 1);
}

process.exit(result.status ?? 1);