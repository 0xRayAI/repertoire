#!/usr/bin/env node
import { RepertoireService } from '../src/RepertoireService.js';
import { discoverFieldLogDirs } from '../src/paths.js';

const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const pathIdx = args.indexOf('--path');

const source = sourceIdx >= 0 ? args[sourceIdx + 1] : 'groover';
const sourcePath = pathIdx >= 0 ? args[pathIdx + 1] : undefined;

const service = new RepertoireService({ syncField: false });

if (source === 'groover') {
  const dirs = sourcePath ? [sourcePath] : discoverFieldLogDirs();
  if (dirs.length === 0) {
    process.stderr.write(
      'Usage: npm run ingest -- --source groover [--path <dir>]\nNo field JSONL dirs found. Set REPERTOIRE_FIELD_LOGS or pass --path.\n',
    );
    process.exit(1);
  }
  const result = service.syncFieldMemory(dirs);
  process.stdout.write(
    `Groover ingest: imported=${result.imported} skipped=${result.skipped} promoted=${result.promoted.join(',') || 'none'} sources=${result.sources.length}\n`,
  );
} else if (source === 'xray') {
  if (!sourcePath) {
    process.stderr.write('Usage: npm run ingest -- --source xray --path <dir>\n');
    process.exit(1);
  }
  const result = service.ingestXraySessions(sourcePath);
  process.stdout.write(`0xRay ingest: imported=${result.imported} skipped=${result.skipped}\n`);
} else {
  process.stderr.write(`Unknown source: ${source}\n`);
  process.exit(1);
}
