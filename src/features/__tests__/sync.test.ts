// FND-OBS-02/04 — write settlements become Sync issues (retry/discard) or the
// quota-paused state; transient codes only get reported.

import { RepoError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../appStore';
import { resetRuntimeForTests } from '../runtime';
import { discardIssue, onWriteEvent, recomputePending, retryIssue } from '../sync';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { FakeAdapter } from './fakeAdapter';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

let adapter: FakeAdapter;

beforeEach(() => {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetFirebaseForTests();
  resetAppStore();
});

test('a permanently refused write surfaces as a Sync issue with its journal', () => {
  onWriteEvent({
    ok: false,
    code: 'permission-denied',
    journal: [{ op: 'update', path: 'vehicles/v1', data: { name: 'x' } }],
  });
  const issues = useAppStore.getState().syncIssues;
  expect(issues).toHaveLength(1);
  expect(issues[0].code).toBe('permission-denied');
  expect(issues[0].journal).toHaveLength(1);
});

test('resource-exhausted pauses sync instead of creating an issue', () => {
  onWriteEvent({ ok: false, code: 'resource-exhausted', journal: [{ op: 'set', path: 'users/u' }] });
  expect(useAppStore.getState().quotaPaused).toBe(true);
  expect(useAppStore.getState().syncIssues).toHaveLength(0);
  expect(adapter.reports).toHaveLength(1); // quota pause is still reported
});

test('the next successful write clears the quota pause (FR-OFF-07)', () => {
  onWriteEvent({ ok: false, code: 'resource-exhausted', journal: [] });
  expect(useAppStore.getState().quotaPaused).toBe(true);
  onWriteEvent({ ok: true });
  expect(useAppStore.getState().quotaPaused).toBe(false);
});

test('transient failures only report — no issue row', () => {
  onWriteEvent({ ok: false, code: 'unavailable', journal: [{ op: 'set', path: 'users/u' }] });
  expect(useAppStore.getState().syncIssues).toHaveLength(0);
  expect(adapter.reports).toHaveLength(1);
});

test('a refused write with an empty journal cannot be retried — just reported', () => {
  onWriteEvent({ ok: false, code: 'permission-denied', journal: [] });
  expect(useAppStore.getState().syncIssues).toHaveLength(0);
});

test('Retry resubmits the journaled ops and clears the issue on ack', async () => {
  onWriteEvent({
    ok: false,
    code: 'permission-denied',
    journal: [{ op: 'set', path: 'vehicles/v1/reminders/r1', data: { title: 'x' } }],
  });
  const id = useAppStore.getState().syncIssues[0].id;
  retryIssue(id);
  await flush();
  expect(adapter.docs.get('vehicles/v1/reminders/r1')).toEqual({ title: 'x' });
  expect(useAppStore.getState().syncIssues).toHaveLength(0);
});

test('a failed retry keeps the issue and refreshes its code', async () => {
  onWriteEvent({
    ok: false,
    code: 'permission-denied',
    journal: [{ op: 'delete', path: 'vehicles/v1/entries/e1' }],
  });
  const id = useAppStore.getState().syncIssues[0].id;
  adapter.commitAck = { reject: new RepoError('invalid-argument') };
  retryIssue(id);
  await flush();
  const issues = useAppStore.getState().syncIssues;
  expect(issues).toHaveLength(1);
  expect(issues[0].code).toBe('invalid-argument');
});

test('Discard drops the issue without touching stored docs', () => {
  onWriteEvent({
    ok: false,
    code: 'not-found',
    journal: [{ op: 'set', path: 'vehicles/v1', data: { name: 'x' } }],
  });
  discardIssue(useAppStore.getState().syncIssues[0].id);
  expect(useAppStore.getState().syncIssues).toHaveLength(0);
  expect(adapter.docs.size).toBe(0);
});

test('recomputePending counts pending docs and in-flight commits (DR-16)', () => {
  useAppStore.setState({
    vehicles: [
      { id: 'v1', pending: true } as unknown as VehicleRecord,
      { id: 'v2', pending: false } as unknown as VehicleRecord,
    ],
  });
  adapter.pending = 3;
  recomputePending();
  expect(useAppStore.getState().pendingChanges).toBe(3);
});
