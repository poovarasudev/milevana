#!/usr/bin/env node
// FND-PLT-01 #3 / AC-D20 / PRV-04 guardrail: no ad SDK and no analytics SDK in the
// dependency tree. Scans package-lock.json for known ad/analytics package names.
import { readFileSync } from 'node:fs';

const FORBIDDEN = [
  /admob/i,
  /react-native-google-mobile-ads/i,
  /expo-ads-/i,
  /^@?react-native-admob/i,
  /inmobi/i,
  /applovin/i,
  /ironsource/i,
  /unity-ads/i,
  /vungle/i,
  /chartboost/i,
  /appodeal/i,
  /startapp/i,
  /adcolony/i,
  /fyber/i,
  /pangle/i,
  /mopub/i,
  /flurry/i,
  /firebase[-/]analytics/i,
  /@react-native-firebase\/analytics/i,
  /expo-analytics(-|$)/i,
  /amplitude/i,
  /mixpanel/i,
  /segment(-|\/|\.|$)/i,
  /analytics-node/i,
  /@segment\//i,
  /posthog/i,
  /datadog/i,
  /appsflyer/i,
  /adjust(-|_|$)/i,
  /branch(-|$)/i,
  /singular(-|$)/i,
  /kochava/i,
  /matomo/i,
  /countly/i,
  /\bheap(-analytics|-js|$)/i,
  /google-analytics/i,
  /\bgtag\b/i,
  /@firebase\/analytics/i,
];

// REL-01: no OTA-update SDK in v1 — store builds are the only update channel.
const FORBIDDEN_OTA = [
  /^expo-updates$/i,
  /code-?push/i,
  /react-native-code-push/i,
];

// The `firebase` umbrella package pulls in @firebase/analytics* transitively;
// it is never imported (enforced by check-boundaries.mjs, which would flag any
// 'firebase/analytics' import outside the adapter) and never configured (no
// measurementId in src/data/firebaseConfig.ts). Allow it as a transitive
// dependency only — it must not appear in package.json's own dependencies.
const ALLOWED_TRANSITIVE = new Set([
  '@firebase/analytics',
  '@firebase/analytics-compat',
  '@firebase/analytics-types',
]);

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const names = new Set();
for (const key of Object.keys(lock.packages ?? {})) {
  const parts = key.split('node_modules/');
  const name = parts[parts.length - 1];
  if (name) names.add(name);
}
const directDeps = new Set(Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies ?? {}));
for (const name of directDeps) names.add(name);

const hits = [...names].filter(
  (n) => FORBIDDEN.some((re) => re.test(n)) && (!ALLOWED_TRANSITIVE.has(n) || directDeps.has(n)),
);
if (hits.length) {
  console.error('Forbidden ad/analytics SDKs found in the dependency tree:\n' + hits.map((h) => '  - ' + h).join('\n'));
  process.exit(1);
}
const ota = [...names].filter((n) => FORBIDDEN_OTA.some((re) => re.test(n)));
if (ota.length) {
  console.error('Forbidden OTA-update SDKs found in the dependency tree:\n' + ota.map((h) => '  - ' + h).join('\n'));
  process.exit(1);
}
console.log(`check-deps: OK (${names.size} packages scanned, no ad, analytics or OTA-update SDK)`);
