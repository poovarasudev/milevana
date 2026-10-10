// REL-01 gate (AC-R2): the release tag is blocked until the Maestro and
// manual checklist results are recorded in docs/release-runs/<tag>.md.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(__dirname, 'check-release-gate.mjs');

function run(tag, cwd) {
  try {
    const out = execFileSync('node', [SCRIPT, tag], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function tree(tag, content) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  mkdirSync(join(dir, 'docs', 'release-runs'), { recursive: true });
  if (content !== undefined) writeFileSync(join(dir, 'docs', 'release-runs', `${tag}.md`), content);
  return dir;
}

test('a tag without a run record fails the gate', () => {
  const r = run('v1.2.3', tree('v1.2.3', undefined));
  expect(r.code).toBe(1);
  expect(r.out).toMatch(/does not exist/);
});

test('a record without both passes fails the gate', () => {
  const dir = tree('v1.2.3', '# Run v1.2.3\n\n- maestro: pass\n- manual checklist: pending\n');
  const r = run('v1.2.3', dir);
  expect(r.code).toBe(1);
  expect(r.out).toMatch(/manual checklist/);
});

test('a record with both passes lets the tag through', () => {
  const dir = tree('v1.2.3', '# Run v1.2.3\n\n- maestro: pass\n- manual checklist: pass\n');
  const r = run('v1.2.3', dir);
  expect(r.code).toBe(0);
});

test('non-semantic tags are rejected', () => {
  const r = run('nightly', tree('nightly'));
  expect(r.code).toBe(1);
  expect(r.out).toMatch(/semantic version tag/);
});
