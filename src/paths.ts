import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compiled to dist/paths.js — one level below package root. */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_DATA_DIR = join(PACKAGE_ROOT, 'data');
export const DEFAULT_SIGNALS_PATH = join(PACKAGE_ROOT, 'data', 'curated_signals.json');
export const DEFAULT_STACK_OVERLAY_PATH = join(PACKAGE_ROOT, 'data', 'stack-overlay.json');
export const DEFAULT_STATE_PATH = join(PACKAGE_ROOT, 'data', 'inference-state.json');
export const DEFAULT_LOG_DIR = join(PACKAGE_ROOT, 'logs', 'groover-inference');
export const DEFAULT_FEEDBACK_DIR = join(PACKAGE_ROOT, 'logs', 'orchestrator-feedback');
export const DEFAULT_MCP_SERVER_PATH = join(PACKAGE_ROOT, 'dist', 'mcp', 'server.js');
export const DEFAULT_PROVIDER_PATH = join(
  PACKAGE_ROOT,
  'dist',
  'provider',
  'memory-routing-provider.js',
);

export function defaultProjectStateDir(cwd = process.cwd()): string {
  return join(cwd, '.xray', 'state', 'repertoire');
}

/** Writable organ paths — always project-local, including when cwd is this repo. */
export function defaultWritablePaths(cwd = process.cwd()): {
  dataDir: string;
  signalsPath: string;
  statePath: string;
  logDir: string;
  feedbackDir: string;
} {
  const dataDir = defaultProjectStateDir(cwd);
  return {
    dataDir,
    signalsPath: join(dataDir, 'curated_signals.json'),
    statePath: join(dataDir, 'inference-state.json'),
    logDir: join(dataDir, 'logs'),
    feedbackDir: join(dataDir, 'feedback'),
  };
}

export function isRepertoirePackageCwd(cwd: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')) as { name?: string };
    return pkg.name === '@0xray/repertoire' || pkg.name === 'repertoire';
  } catch {
    return false;
  }
}

export function isImmutablePackagePath(filePath: string): boolean {
  const normalized = resolve(filePath);
  const root = resolve(PACKAGE_ROOT);
  if (normalized === root || normalized.startsWith(root + sep)) return true;
  return normalized.includes(`${sep}node_modules${sep}@0xray${sep}repertoire${sep}`);
}

/** Tarball registry only — not project-local `.xray/state/repertoire/` even inside this repo. */
export function isFactorySeedFile(filePath: string): boolean {
  const normalized = resolve(filePath);
  if (normalized === resolve(DEFAULT_SIGNALS_PATH)) return true;
  return normalized.includes(
    `${sep}node_modules${sep}@0xray${sep}repertoire${sep}data${sep}curated_signals.json`,
  );
}

/** Signals seed is readable; missing consumer path may fall back to the package file. */
export function resolveReadableConfigPath(
  configured: string | undefined,
  cwd: string,
  packageDefault: string,
): string {
  if (!configured) return packageDefault;
  const fromCwd = resolve(cwd, configured);
  if (existsSync(fromCwd)) return fromCwd;
  if (existsSync(configured)) return resolve(configured);
  if (existsSync(packageDefault)) return packageDefault;
  return fromCwd;
}

/** State/feedback paths must not silently fall back into the package. */
export function resolveWritableConfigPath(
  configured: string | undefined,
  cwd: string,
  fallback: string,
): string {
  if (!configured) return fallback;
  if (configured.startsWith('/') || /^[A-Za-z]:[\\/]/.test(configured)) return configured;
  return resolve(cwd, configured);
}

interface OverlaySignalRecord {
  name: string;
  definition: string;
}

function isOverlaySignalRecord(value: unknown): value is OverlaySignalRecord {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec.name === 'string' && rec.name.length > 0 && typeof rec.definition === 'string';
}

/**
 * Additive merge of `data/stack-overlay.json` into a project copy.
 * Existing names keep their stats. Missing overlay names are appended.
 * Refuses the factory tarball path.
 */
export function mergeStackOverlay(
  destPath: string,
  overlayPath = DEFAULT_STACK_OVERLAY_PATH,
): number {
  if (isFactorySeedFile(destPath)) {
    return 0;
  }
  if (!existsSync(destPath) || !existsSync(overlayPath)) {
    return 0;
  }
  const destRaw = JSON.parse(readFileSync(destPath, 'utf8')) as {
    last_updated?: string;
    signals?: unknown;
  };
  const overlayRaw = JSON.parse(readFileSync(overlayPath, 'utf8')) as { signals?: unknown };
  if (!Array.isArray(destRaw.signals) || !Array.isArray(overlayRaw.signals)) {
    return 0;
  }
  const have = new Set(
    destRaw.signals
      .filter(isOverlaySignalRecord)
      .map((signal) => signal.name),
  );
  const incoming = overlayRaw.signals.filter(isOverlaySignalRecord);
  let added = 0;
  for (const signal of incoming) {
    if (have.has(signal.name)) continue;
    destRaw.signals.push(signal);
    have.add(signal.name);
    added += 1;
  }
  if (added > 0) {
    destRaw.last_updated = new Date().toISOString();
    writeFileSync(destPath, `${JSON.stringify(destRaw, null, 2)}\n`);
  }
  return added;
}

/**
 * Package seed stays read-only. Any cwd — consumer or this organ repo — hydrates
 * `.xray/state/repertoire/curated_signals.json`. Dogfooding the package must not
 * mutate `data/curated_signals.json` (the tarball). After copy, merge
 * `data/stack-overlay.json` additively so stack language survives a new clone.
 */
function isProjectSignalsDest(filePath: string, cwd: string): boolean {
  return resolve(filePath) === resolve(join(defaultProjectStateDir(cwd), 'curated_signals.json'));
}

/**
 * Explicit field JSONL producers. Groover is not Repertoire — do not walk
 * sibling `../groover/` or `research/groover-inference-logs*` by default.
 * `REPERTOIRE_FIELD_LOGS` is a colon-separated list of dirs.
 */
export function discoverFieldLogDirs(_cwd = process.cwd()): string[] {
  const fromEnv = (process.env.REPERTOIRE_FIELD_LOGS ?? '')
    .split(':')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const candidates = [...fromEnv];
  const seen = new Set<string>();
  const found: string[] = [];
  for (const dir of candidates) {
    const resolved = resolve(dir);
    if (seen.has(resolved) || !existsSync(resolved)) continue;
    let files: string[] = [];
    try {
      files = readdirSync(resolved).filter((file) => file.endsWith('.jsonl'));
    } catch {
      continue;
    }
    if (files.length === 0) continue;
    seen.add(resolved);
    found.push(resolved);
  }
  return found;
}

/** Tests stay isolated. CLI / wear syncs when sibling field logs exist. */
export function shouldAutoSyncField(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (process.env.REPERTOIRE_FIELD_SYNC === '0') return false;
  if (process.env.REPERTOIRE_FIELD_SYNC === '1') return true;
  return process.env.VITEST !== 'true';
}

function isGrooverExperimentDir(dir: string): boolean {
  const normalized = resolve(dir);
  return (
    normalized.includes(`${sep}groover-inference-logs`) ||
    normalized.includes(`${sep}repertoire-brain${sep}`) ||
    normalized.endsWith(`${sep}repertoire-brain`)
  );
}

function hasSessionJson(dir: string): boolean {
  try {
    return readdirSync(dir).some((file) => file.startsWith('session-') && file.endsWith('.json'));
  } catch {
    return false;
  }
}

/**
 * 0xRay session-capture dirs. Groover field JSONL is not a source.
 * `REPERTOIRE_XRAY_LOGS` is a colon-separated list. Also walks this project
 * and sibling `docs/inference` / `.xray/inference` when they hold session-*.json.
 */
export function discoverXrayKernelDirs(cwd = process.cwd()): string[] {
  const fromEnv = (process.env.REPERTOIRE_XRAY_LOGS ?? '')
    .split(':')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const candidates = [...fromEnv, join(cwd, 'docs', 'inference'), join(cwd, '.xray', 'inference')];
  const parent = resolve(cwd, '..');
  if (existsSync(parent) && shouldWalkSiblingRepos(parent)) {
    try {
      for (const name of readdirSync(parent)) {
        if (name.startsWith('.') || name === 'node_modules') continue;
        const sibling = join(parent, name);
        candidates.push(join(sibling, 'docs', 'inference'), join(sibling, '.xray', 'inference'));
      }
    } catch {
      /* parent not listable */
    }
  }
  const seen = new Set<string>();
  const found: string[] = [];
  for (const dir of candidates) {
    const resolved = resolve(dir);
    if (seen.has(resolved) || isGrooverExperimentDir(resolved) || !existsSync(resolved)) continue;
    if (!hasSessionJson(resolved)) continue;
    seen.add(resolved);
    found.push(resolved);
  }
  return found;
}

export function shouldAutoSyncXray(explicit?: boolean): boolean {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (process.env.REPERTOIRE_XRAY_SYNC === '0') return false;
  if (process.env.REPERTOIRE_XRAY_SYNC === '1') return true;
  return process.env.VITEST !== 'true';
}

export interface SiblingRepo {
  root: string;
  name: string;
  description: string;
  primitive: string;
}

function shouldWalkSiblingRepos(parent: string): boolean {
  try {
    const names = new Set(readdirSync(parent));
    return names.has('xray') || names.has('repertoire') || names.has('clearing');
  } catch {
    return false;
  }
}

function siblingRepoSlug(raw: string): string | null {
  const bare = raw.replace(/^@[^/]+\//, '');
  const slug = bare
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/^[a-z][a-z0-9-]{2,119}$/.test(slug)) return null;
  if (/^phase-\d/.test(slug)) return null;
  return slug;
}

function siblingRepoPrimitiveName(pkgName: string, dirName?: string): string | null {
  const slug = siblingRepoSlug(pkgName) ?? (dirName ? siblingRepoSlug(dirName) : null);
  if (!slug) return null;
  const name = slug.startsWith('repo-') ? slug : `repo-${slug}`;
  if (!/^[a-z][a-z0-9-]{2,119}$/.test(name)) return null;
  return name;
}

/** Sibling package.json map. Hangars stay hangars — we remember them, we do not suit them. */
export function discoverSiblingRepos(cwd = process.cwd()): SiblingRepo[] {
  const parent = resolve(cwd, '..');
  const found: SiblingRepo[] = [];
  if (!existsSync(parent) || !shouldWalkSiblingRepos(parent)) return found;
  let names: string[] = [];
  try {
    names = readdirSync(parent);
  } catch {
    return found;
  }
  for (const name of names) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const root = join(parent, name);
    const pkgPath = join(root, 'package.json');
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        name?: string;
        description?: string;
      };
      const primitive = siblingRepoPrimitiveName(pkg.name || name, name);
      if (!primitive) continue;
      found.push({
        root,
        name: pkg.name || name,
        description: typeof pkg.description === 'string' ? pkg.description : name,
        primitive,
      });
    } catch {
      continue;
    }
  }
  return found;
}

export interface OpProcReload {
  dest: string;
  names: string[];
  count: number;
}

function signalNamesFrom(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as { signals?: Array<{ name?: string }> };
    if (!Array.isArray(raw.signals)) return [];
    return raw.signals
      .map((signal) => (typeof signal.name === 'string' ? signal.name : ''))
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
}

/**
 * Overlay + factory names on the project dest. This is OP-PROC.
 * Not Station. After compact the suit reloads these from dest.
 */
export function reloadOpProc(cwd = process.cwd()): OpProcReload {
  const dest = hydrateWritableSignals(DEFAULT_SIGNALS_PATH, cwd);
  const factory = new Set(signalNamesFrom(DEFAULT_SIGNALS_PATH));
  const overlay = new Set(signalNamesFrom(DEFAULT_STACK_OVERLAY_PATH));
  const names = signalNamesFrom(dest).filter((name) => factory.has(name) || overlay.has(name));
  return { dest, names, count: names.length };
}

export function hydrateWritableSignals(seedPath: string, cwd = process.cwd()): string {
  if (!isImmutablePackagePath(seedPath)) {
    if (isProjectSignalsDest(seedPath, cwd)) {
      mergeStackOverlay(seedPath);
    }
    return seedPath;
  }
  const seed = existsSync(seedPath) ? seedPath : DEFAULT_SIGNALS_PATH;
  const dest = join(defaultProjectStateDir(cwd), 'curated_signals.json');
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest) && existsSync(seed)) {
    copyFileSync(seed, dest);
  }
  if (existsSync(dest)) {
    mergeStackOverlay(dest);
  }
  return dest;
}

/** @deprecated use resolveReadableConfigPath */
export const resolveProviderConfigPath = resolveReadableConfigPath;