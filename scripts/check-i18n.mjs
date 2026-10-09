#!/usr/bin/env node
// FND-SET-01 / FR-I18N-03 / FR-SCAF-07 — CI check that UI files carry no
// hard-coded user-visible strings. Scans app/ and src/ UI surfaces
// (.ts/.tsx); test files, schema files and generated bundles are exempt.
// Escape hatch for a proven non-visible string: suffix the line with
// `// i18n-allow`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanSource } = require('./lib/i18n-scan.js');

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['app', 'src'];
const EXEMPT = /(__tests__|\.test\.|\.d\.ts$|i18n[\\/]en\.ts|schema[\\/]|localFlags|check-|tests-stubs|testkit)/;

const argDir = process.argv[2];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      yield* files(p);
    } else if (/\.(ts|tsx)$/.test(name) && !EXEMPT.test(p)) {
      yield p;
    }
  }
}

let bad = 0;
const dirs = argDir ? [join(ROOT, argDir)] : SCAN_DIRS.map((d) => join(ROOT, d));
for (const dir of dirs) {
  for (const f of files(dir)) {
    const src = readFileSync(f, 'utf8');
    for (const hit of scanSource(src, f)) {
      bad++;
      console.log(`${relative(ROOT, f)}:${hit.line}  hard-coded string "${hit.text}" — use t('…') or suffix // i18n-allow`);
    }
  }
}
if (bad > 0) {
  console.error(`\ni18n check failed: ${bad} hard-coded string(s).`);
  process.exit(1);
}
console.log('i18n check passed.');
