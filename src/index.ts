export { RepertoireService } from './RepertoireService.js';
export {
  CuratedSignalsManager,
  isFieldPrimitiveName,
  proposeFieldObservedSignal,
  repoPrimitiveName,
  slugFieldPrimitiveName,
} from './registry/CuratedSignalsManager.js';
export { pruneSignals, shouldPruneSignal } from './registry/signal-prune.js';
export {
  decayFactorForAge,
  effectiveObservationConfidence,
  effectiveSignalConfidence,
  rawDecayedConfidence,
  shouldDemoteValidatedSignal,
  DEFAULT_DECAY_GRACE_DAYS,
  DEFAULT_DECAY_HALF_LIFE_DAYS,
  DEFAULT_DEMOTION_MIN_OBSERVATIONS,
} from './registry/confidence-decay.js';
export { InferenceStateManager } from './registry/InferenceStateManager.js';
export { MetaInferenceEngine } from './synthesis/meta-inference-engine.js';
export { GrooverLogIngester } from './ingestion/groover-log-ingester.js';
export {
  collectKernelDiaryText,
  discoverFieldLogDirs,
  discoverSiblingRepos,
  discoverXrayKernelDirs,
  isGenericFieldObservedDefinition,
  mergeSubjectOverlay,
  reloadOpProc,
  shouldAutoSyncField,
  shouldAutoSyncXray,
  defaultWritablePaths,
} from './paths.js';
export {
  aggregateWeightedPrimitives,
  formatWeightedPrimitivesSection,
} from './synthesis/primitive-confidence-aggregator.js';
export { XraySessionIngester } from './ingestion/xray-session-ingester.js';
export { OrchestratorFeedbackIngester } from './ingestion/orchestrator-feedback-ingester.js';
export { RepertoireOrchestratorBridge } from './orchestrator-bridge/RepertoireOrchestratorBridge.js';
export {
  getConfidenceForTask,
  DEFAULT_MIN_CONFIDENCE_GATE,
  TRAP_CAPABLE_AGENTS,
} from './orchestrator-bridge/confidence-gate.js';
export { OntologicalTrapEnforcer } from './governance/ontological-trap-enforcer.js';
export * from './types.js';