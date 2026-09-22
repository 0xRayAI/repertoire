#!/usr/bin/env node
/**
 * Consumer install smoke — verifies the published package layout works
 * without sibling-repo paths or env overrides.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

const checks = [];

function assert(label, ok, detail = '') {
  checks.push({ label, ok, detail });
  if (!ok) {
    process.stderr.write(`FAIL: ${label}${detail ? ` — ${detail}` : ''}\n`);
  }
}

assert('package name', pkg.name === '@0xray/repertoire');
assert('version 0.2+', typeof pkg.version === 'string' && pkg.version.startsWith('0.2'));
assert('files field defined', Array.isArray(pkg.files) && pkg.files.length > 0);
assert('no runtime 0xray dependency', !pkg.dependencies || pkg.dependencies['0xray'] == null);

function packedManifest() {
  const raw = execFileSync('npm', ['pack', '--json', '--ignore-scripts'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const parsed = JSON.parse(raw);
  const filename = Array.isArray(parsed) ? parsed[0].filename : parsed.filename;
  const tgz = join(repoRoot, filename);
  const dir = mkdtempSync(join(tmpdir(), 'repertoire-pack-'));
  try {
    execFileSync('tar', ['-xzf', tgz, '-C', dir]);
    return JSON.parse(readFileSync(join(dir, 'package', 'package.json'), 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (existsSync(tgz)) rmSync(tgz);
  }
}

const packed = packedManifest();
assert(
  'packed tarball has no 0xray dependency',
  packed.dependencies?.['0xray'] === undefined,
  JSON.stringify(packed.dependencies ?? {}),
);
assert(
  'packed tarball has no file: dependency specifiers',
  !JSON.stringify(packed.dependencies ?? {}).includes('file:'),
  JSON.stringify(packed.dependencies ?? {}),
);

const requiredPaths = [
  'dist/index.js',
  'dist/mcp/server.js',
  'dist/provider/memory-routing-provider.js',
  'scripts/verify-grok-suit.mjs',
  'scripts/suit-bridge-shared.mjs',
  'data/curated_signals.json',
  'data/stack-overlay.json',
  'data/subject-overlay.json',
  'LICENSE',
  'README.md',
];

for (const rel of requiredPaths) {
  assert(`exists ${rel}`, existsSync(join(repoRoot, rel)));
}

const { createMemoryRoutingProvider } = await import(
  pathToFileURL(join(repoRoot, 'dist/provider/memory-routing-provider.js')).href
);

const consumerRoot = mkdtempSync(join(tmpdir(), 'repertoire-smoke-consumer-'));
writeFileSync(join(consumerRoot, 'package.json'), JSON.stringify({ name: 'smoke-consumer' }));
const provider = createMemoryRoutingProvider({ projectRoot: consumerRoot });
assert('provider id', provider.id === 'repertoire');
assert('provider available', provider.isAvailable());

const trapTask = {
  id: 'consumer-smoke-trap',
  description: 'TYPE: ontological-trap attestation-as-map consumer-boundary revalidation',
  type: 'governance',
};

const confidence = provider.getTaskConfidence?.(trapTask);
assert('getTaskConfidence returns', confidence != null);
assert(
  'trap detected in bundled registry',
  confidence?.highConfidenceTrapPresent === true,
  `got trap=${confidence?.highConfidenceTrapPresent}`,
);
assert(
  'recommendedAgent is architect',
  confidence?.recommendedAgent === 'architect',
  `got ${confidence?.recommendedAgent}`,
);

const mcpScript = pkg.scripts?.mcp ?? '';
assert('mcp npm script', mcpScript.includes('dist/mcp/server.js'));

const signals = JSON.parse(readFileSync(join(repoRoot, 'data/curated_signals.json'), 'utf8'));
const names = (signals.signals || []).map((s) => s.name);
assert('factory seed size', names.length === 8, `got ${names.length}`);
assert(
  'factory seed has no bedrock signals',
  !names.some((n) => String(n).toLowerCase().startsWith('bedrock')),
);
assert('seed includes attestation-as-map', names.includes('attestation-as-map'));
assert(
  'seed includes consumption-boundary-revalidation-gate',
  names.includes('consumption-boundary-revalidation-gate'),
);

const overlay = JSON.parse(readFileSync(join(repoRoot, 'data/stack-overlay.json'), 'utf8'));
const overlayNames = (overlay.signals || []).map((s) => s.name);
assert('stack overlay size', overlayNames.length >= 24, `got ${overlayNames.length}`);
assert('overlay includes repertoire-is-long-running-kb', overlayNames.includes('repertoire-is-long-running-kb'));
assert('overlay includes clean-ticks-every-cycle', overlayNames.includes('clean-ticks-every-cycle'));
assert(
  'overlay does not duplicate factory names',
  !overlayNames.some((n) => names.includes(n)),
);

const stackTask = {
  id: 'consumer-smoke-stack',
  description: 'Factory seed is not the brain. Wear the project copy. Repertoire is the long-running KB.',
  type: 'general',
};
const stackConfidence = provider.getTaskConfidence?.(stackTask);
assert(
  'stack language matches after hydrate',
  Array.isArray(stackConfidence?.matchedSignals) && stackConfidence.matchedSignals.length > 0,
  `got ${JSON.stringify(stackConfidence?.matchedSignals ?? [])}`,
);

const subject = JSON.parse(readFileSync(join(repoRoot, 'data/subject-overlay.json'), 'utf8'));
const subjectNames = (subject.signals || []).map((s) => s.name);
assert('subject overlay size', subjectNames.length >= 10, `got ${subjectNames.length}`);
assert('subject includes repo-clearing', subjectNames.includes('repo-clearing'));
assert(
  'subject does not duplicate factory or stack names',
  !subjectNames.some((n) => names.includes(n) || overlayNames.includes(n)),
);
const subjectTask = {
  id: 'consumer-smoke-subject',
  description: 'Pay only live x402 services. Never double-pay. Receipted URL extract catalog.',
  type: 'general',
};
const subjectConfidence = provider.getTaskConfidence?.(subjectTask);
assert(
  'subject language matches after hydrate',
  Array.isArray(subjectConfidence?.matchedSignals) &&
    subjectConfidence.matchedSignals.includes('repo-clearing'),
  `got ${JSON.stringify(subjectConfidence?.matchedSignals ?? [])}`,
);

rmSync(consumerRoot, { recursive: true, force: true });

const failed = checks.filter((c) => !c.ok);
if (failed.length > 0) {
  process.stderr.write(`\n❌ Consumer smoke failed (${failed.length}/${checks.length})\n`);
  process.exit(1);
}

process.stdout.write(`✅ Consumer smoke passed (${checks.length} checks)\n`);