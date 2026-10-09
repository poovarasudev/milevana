// FND-OBS-05 / PRV-03/PRV-13 — the reporting funnel must strip everything but
// error codes and whitelisted context keys, and must never throw.

import { AuthError, RepoError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { reportNonFatal, triggerTestCrash } from '../reporting';
import { resetRuntimeForTests } from '../runtime';
import { FakeAdapter } from './fakeAdapter';

let adapter: FakeAdapter;

beforeEach(() => {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetFirebaseForTests();
});

test('RepoError is reduced to its code — the message is never forwarded', () => {
  reportNonFatal(new RepoError('permission-denied', 'plate ABC1234 uid secret'));
  expect(adapter.reports).toHaveLength(1);
  const sent = adapter.reports[0].error as Error;
  expect(sent.message).toBe('RepoError:permission-denied');
  expect(sent.message).not.toContain('ABC1234');
});

test('AuthError is reduced to its code', () => {
  reportNonFatal(new AuthError('credential-already-in-use', 'google token xyz'));
  expect((adapter.reports[0].error as Error).message).toBe('AuthError:credential-already-in-use');
});

test('unknown errors report only their name', () => {
  const e = new TypeError('user free text notes');
  reportNonFatal(e);
  expect((adapter.reports[0].error as Error).message).toBe('Error:TypeError');
});

test('context keys outside the whitelist are dropped', () => {
  reportNonFatal(new RepoError('unknown'), {
    screen: 'settings',
    action: 'link',
    uid: 'user-uid-123',
    vehicleName: 'My car',
    plate: 'TN01AB1234',
    inviteCode: 'XYZ123',
    notes: 'free-form text',
  });
  const ctx = adapter.reports[0].context!;
  expect(ctx).toEqual({ screen: 'settings', action: 'link' });
});

test('invite codes inside paths are redacted', () => {
  reportNonFatal(new RepoError('not-found'), { path: 'invites/SECRET9/vehicles/v1' });
  expect(adapter.reports[0].context!.path).toBe('invites/<redacted>/vehicles/v1');
});

test('reporting never throws even when the adapter hook fails', () => {
  adapter.reportNonFatal = () => {
    throw new Error('crashlytics dead');
  };
  expect(() => reportNonFatal(new RepoError('unknown'), { screen: 'x' })).not.toThrow();
});

test('testCrash forwards to the adapter hook', () => {
  triggerTestCrash();
  expect(adapter.crashes).toBe(1);
});

test('web adapter hook is a safe no-op surface', () => {
  const web = new FakeAdapter('web');
  setFirebaseFactory(() => web);
  resetFirebaseForTests();
  reportNonFatal(new RepoError('offline'));
  // Web routes to its own no-op hook; still exactly one recorded call.
  expect(web.reports).toHaveLength(1);
});
