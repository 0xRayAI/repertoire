import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compiled to dist/paths.js — one level below package root. */
export const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_DATA_DIR = join(PACKAGE_ROOT, 'data');
export const DEFAULT_SIGNALS_PATH = join(PACKAGE_ROOT, 'data', 'curated_signals.json');
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

/**
 * Package seed stays read-only. Any cwd — consumer or this organ repo — hydrates
 * `.xray/state/repertoire/curated_signals.json`. Dogfooding the package must not
 * mutate `data/curated_signals.json` (the tarball).
 */
export function hydrateWritableSignals(seedPath: string, cwd = process.cwd()): string {
  if (!isImmutablePackagePath(seedPath)) {
    return seedPath;
  }
  const seed = existsSync(seedPath) ? seedPath : DEFAULT_SIGNALS_PATH;
  const dest = join(defaultProjectStateDir(cwd), 'curated_signals.json');
  mkdirSync(dirname(dest), { recursive: true });
  if (!existsSync(dest) && existsSync(seed)) {
    copyFileSync(seed, dest);
  }
  return dest;
}

/** @deprecated use resolveReadableConfigPath */
export const resolveProviderConfigPath = resolveReadableConfigPath;