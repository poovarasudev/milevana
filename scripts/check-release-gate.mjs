#!/usr/bin/env node
// REL-01 gate (AC-R2): a release tag's build is blocked until the Maestro and
// manual checklist results are recorded for that tag.
//
// Usage: node scripts/check-release-gate.mjs <tag>     e.g. v0.1.0
//
// The record lives at docs/release-runs/<tag>.md — copy TEMPLATE.md, run the
// Maestro suite on a device and the manual checklist in
// docs/release-verification.md, then fill in the result lines:
//   maestro: pass
//   manual checklist: pass
// Any other value (or a missing file) fails the gate, so a tag can never
// reach EAS Build / Firebase deploy without recorded evidence.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+/.test(tag)) {
  console.error(`check-release-gate: expected a semantic version tag (vX.Y.Z), got '${tag ?? ''}'`);
  process.exit(1);
}

const file = join('docs', 'release-runs', `${tag}.md`);
if (!existsSync(file)) {
  console.error(
    `check-release-gate: ${file} does not exist.\n` +
      'Copy docs/release-runs/TEMPLATE.md, record the Maestro and manual checklist results, then re-tag.',
  );
  process.exit(1);
}

const text = readFileSync(file, 'utf8');
const missing = ['maestro', 'manual checklist'].filter(
  (k) => !new RegExp(`^\\s*-\\s*${k}:\\s*pass\\s*$`, 'im').test(text),
);
if (missing.length) {
  console.error(
    `check-release-gate: ${file} does not record a pass for: ${missing.join(', ')}.\n` +
      'A release run is blocked until the Maestro and manual checklist results are recorded (AC-R2).',
  );
  process.exit(1);
}
console.log(`check-release-gate: ${tag} has recorded Maestro + manual checklist passes`);
