#!/usr/bin/env node
// FND-PLT-01 #2 / AC-D19 / AC-D20 / REM-03 #4 guardrail: the merged Android
// release manifest must not contain READ_MEDIA_IMAGES, READ_EXTERNAL_STORAGE,
// any location permission, or an exact-alarm permission. Usage:
//   node scripts/check-manifest.mjs [path-to-merged-AndroidManifest.xml]
// With no argument it looks in the standard Expo/Gradle merged-manifest locations.
// If no merged manifest exists (no native build has run), it verifies the
// app.json blockedPermissions guard is configured and exits 0 — the manifest
// check then runs for real in the Android build job.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
];

// REL-15 #4: receipts need CAMERA — a merged manifest missing it fails too.
const REQUIRED = ['android.permission.CAMERA'];

// REL-01: no OTA updates in v1 — reject EAS Update / CodePush config fields.
function checkNoOta(appJson) {
  const expo = appJson?.expo ?? {};
  const bad = ['updates', 'runtimeVersion'].filter((k) => expo[k] !== undefined);
  if (bad.length) {
    console.error(`check-manifest: OTA config found in app.json (${bad.join(', ')}) — v1 ships no OTA updates (VD/REL-01)`);
    process.exit(1);
  }
}

function* findManifests(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* findManifests(p);
    else if (name === 'AndroidManifest.xml') yield p;
  }
}

const arg = process.argv[2];
const candidates = arg
  ? [arg]
  : [
      ...findManifests('android/app/build/intermediates/merged_manifests'),
      ...findManifests('android/app/build/intermediates/merged_manifest'),
      ...findManifests('android/app/build/outputs/logs'),
    ];

const appJson = JSON.parse(readFileSync('app.json', 'utf8'));
checkNoOta(appJson);

if (!candidates.length || !candidates.some((p) => existsSync(p))) {
  // No merged manifest: verify the strip config is declared so a future build keeps it clean.
  const blocked = appJson?.expo?.android?.blockedPermissions ?? [];
  const missing = FORBIDDEN.slice(0, 4).filter((p) => !blocked.includes(p));
  const missingLoc = FORBIDDEN.slice(4).filter((p) => !blocked.includes(p));
  if (missing.length || missingLoc.length) {
    console.error(
      'check-manifest: no merged manifest found and app.json android.blockedPermissions does not cover: ' +
        [...missing, ...missingLoc].join(', '),
    );
    process.exit(1);
  }
  const imagePicker = (appJson?.expo?.plugins ?? []).find(
    (p) => Array.isArray(p) && p[0] === 'expo-image-picker',
  );
  if (!imagePicker?.[1]?.cameraPermission) {
    console.error('check-manifest: expo-image-picker cameraPermission not configured — CAMERA would be missing from the manifest');
    process.exit(1);
  }
  console.log('check-manifest: no merged manifest present; app.json blockedPermissions covers all forbidden permissions, cameraPermission configured, no OTA config');
  process.exit(0);
}

let failed = false;
for (const m of candidates.filter((p) => existsSync(p))) {
  const xml = readFileSync(m, 'utf8');
  const found = FORBIDDEN.filter((p) => xml.includes(p));
  const absent = REQUIRED.filter((p) => !xml.includes(p));
  if (found.length || absent.length) {
    console.error(
      `check-manifest: ${m}` +
        (found.length ? ` contains forbidden permissions: ${found.join(', ')}` : '') +
        (absent.length ? ` is missing required permissions: ${absent.join(', ')}` : ''),
    );
    failed = true;
  } else {
    console.log(`check-manifest: ${m} clean`);
  }
}
process.exit(failed ? 1 : 0);
