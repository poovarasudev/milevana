#!/usr/bin/env node
// FND-PLT-01 / FR-DATA-01 / NFR-14 guardrail:
//  - only adapter files may import @react-native-firebase/* or firebase/* (JS SDK)
//  - only adapter files (and cosmetic code in src/ui) may branch on Platform.OS / Platform.select
// Exit 1 with a list of violations.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'app'];
const ADAPTER = /(?:^|[/.])(native|web)\.[tj]sx?$/; // firebase.native.ts, driveClient.web.ts, ...
const PLATFORM_ADAPTER = /firebase\.(native|web)\.[tj]sx?$/;

const violations = [];

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.') || name === 'dist' || name === 'web-build') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.[tj]sx?$/.test(name)) yield p;
  }
}

const IMPORT_RE = /(?:import|export)[^\n]*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const PLATFORM_RE = /\bPlatform\.(OS|select)\b/;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    if (rel.endsWith('.d.ts')) continue;
    const isAdapter = ADAPTER.test(rel);
    const isFirebaseAdapter = PLATFORM_ADAPTER.test(rel) || /(^|\/)firebase\.ts$/.test(rel);
    const isUiLayer = rel.startsWith('src/ui/');
    // Test files aren't bundled; emulator suites may wire the web SDK to the
    // Firestore emulator directly.
    const isTest = rel.includes('__tests__') || /\.(test|spec)\.[tj]sx?$/.test(rel);
    const src = readFileSync(file, 'utf8');

    let m;
    while ((m = IMPORT_RE.exec(src))) {
      const mod = m[1] ?? m[2];
      if (!mod) continue;
      if (mod.startsWith('@react-native-firebase/') && !isAdapter) {
        violations.push(`${rel}: imports native Firebase module '${mod}'`);
      }
      if ((mod === 'firebase' || mod.startsWith('firebase/')) && !isFirebaseAdapter && !isTest) {
        violations.push(`${rel}: imports Firebase JS SDK '${mod}' outside the adapter`);
      }
    }

    if (!isAdapter && !isUiLayer && PLATFORM_RE.test(src)) {
      violations.push(`${rel}: branches on Platform.OS/Platform.select outside an adapter`);
    }
  }
}

if (violations.length) {
  console.error('Platform-boundary violations:\n' + violations.map((v) => '  - ' + v).join('\n'));
  process.exit(1);
}
console.log('check-boundaries: OK (no platform/native-SDK imports outside adapters)');
