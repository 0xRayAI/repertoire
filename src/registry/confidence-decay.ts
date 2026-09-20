import { DEFAULT_PROMOTION_MIN_CONFIDENCE } from './CuratedSignalsManager.js';
import type { CuratedSignal } from '../types.js';

/** Days of full-strength excess before exponential fade starts. */
export const DEFAULT_DECAY_GRACE_DAYS = 14;

/** Half-life of conviction *above* the 0.55 gate after the grace window. */
export const DEFAULT_DECAY_HALF_LIFE_DAYS = 60;

/**
 * Established factory / field corpora are not demoted by calendar age.
 * Project-local signals below this count can lose `validated` when raw decay
 * drops them under the gate.
 */
export const DEFAULT_DEMOTION_MIN_OBSERVATIONS = 100;

export interface DecayOptions {
  graceDays?: number;
  halfLifeDays?: number;
  minGate?: number;
  now?: Date;
}

export interface EffectiveConfidence {
  storedConfidence: number;
  effectiveConfidence: number;
  decayFactor: number;
  staleDays: number;
}

function daysSince(iso: string | undefined, now: Date): number {
  if (!iso) return 0;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 0;
  return Math.max(0, (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Excess-above-gate fade: `gate + (avg - gate) * 2^(-(age-grace)/halfLife)`.
 *
 * Factory seed sits on the 0.55 floor — decay must not kill those primitives.
 * Fresh field conviction still outranks stale high scores when ranking.
 */
export function decayFactorForAge(
  staleDays: number,
  options: DecayOptions = {},
): number {
  const grace = options.graceDays ?? DEFAULT_DECAY_GRACE_DAYS;
  const halfLife = options.halfLifeDays ?? DEFAULT_DECAY_HALF_LIFE_DAYS;
  if (halfLife <= 0) return 1;
  const aged = Math.max(0, staleDays - grace);
  if (aged === 0) return 1;
  return 2 ** (-aged / halfLife);
}

export function effectiveObservationConfidence(
  storedConfidence: number,
  lastSeen: string | undefined,
  options: DecayOptions = {},
): EffectiveConfidence {
  const now = options.now ?? new Date();
  const minGate = options.minGate ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
  const staleDays = daysSince(lastSeen, now);
  const factor = decayFactorForAge(staleDays, options);

  if (storedConfidence <= minGate) {
    return {
      storedConfidence,
      effectiveConfidence: storedConfidence,
      decayFactor: factor,
      staleDays,
    };
  }

  const excess = storedConfidence - minGate;
  const effectiveConfidence = Math.min(1, minGate + excess * factor);

  return {
    storedConfidence,
    effectiveConfidence,
    decayFactor: factor,
    staleDays,
  };
}

export function effectiveSignalConfidence(
  signal: CuratedSignal,
  options: DecayOptions = {},
): EffectiveConfidence | null {
  const stats = signal.observation_stats;
  if (stats?.avg_confidence === undefined) return null;
  return effectiveObservationConfidence(stats.avg_confidence, stats.last_seen, options);
}

/** Raw (unfloored) decay — used only for demotion, never for routing. */
export function rawDecayedConfidence(
  storedConfidence: number,
  lastSeen: string | undefined,
  options: DecayOptions = {},
): number {
  const now = options.now ?? new Date();
  const staleDays = daysSince(lastSeen, now);
  return storedConfidence * decayFactorForAge(staleDays, options);
}

export function shouldDemoteValidatedSignal(
  signal: CuratedSignal,
  options: DecayOptions & { minObservations?: number } = {},
): boolean {
  if ((signal.status ?? 'proposed') !== 'validated') return false;
  const stats = signal.observation_stats;
  if (!stats) return false;

  const minObs = options.minObservations ?? DEFAULT_DEMOTION_MIN_OBSERVATIONS;
  if (stats.observation_count >= minObs) return false;

  const minGate = options.minGate ?? DEFAULT_PROMOTION_MIN_CONFIDENCE;
  const raw = rawDecayedConfidence(stats.avg_confidence, stats.last_seen, options);
  return raw < minGate;
}
