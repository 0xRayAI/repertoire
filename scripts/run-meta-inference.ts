#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';
import { formatMetaInferenceFailure } from '../src/synthesis/meta-inference-engine.js';

const service = new RepertoireService();

try {
  const report = await service.runMetaInference();

  if (!report) {
    process.stdout.write('No new entries to process.\n');
    process.exit(0);
  }

  process.stdout.write(`Meta-inference complete: ${report.entriesProcessed} entries\n`);
  process.stdout.write(
    `Dynamo PASS: ${report.dynamoStats.pass}, REJECT: ${report.dynamoStats.reject}\n`,
  );
  process.stdout.write(
    `Avg resonance: ${report.dynamoStats.avgResonance?.toFixed(3) ?? 'N/A'}\n`,
  );
} catch (error) {
  process.stderr.write(`${formatMetaInferenceFailure(error)}\n`);
  process.exit(1);
}