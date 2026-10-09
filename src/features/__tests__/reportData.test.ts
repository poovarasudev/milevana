// RPT-04 — the report entry cache: the selected vehicle reuses the shared
// watch (History ↔ Reports ↔ Dashboard, zero extra reads), All-vehicles loads
// each vehicle in turn, a failed vehicle is skipped, refresh forces a server
// read, and watches stay live so other-device changes stream in.

import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { RepoError } from '../../data/adapter';
import { resetAppStore, useAppStore } from '../appStore';
import { getRepos, resetRuntimeForTests } from '../runtime';
import {
  entriesArrivedForReport, entriesForReport, refreshReportEntries,
  reportEntriesFailed, stopReportEntryWatches, syncReportEntryWatches,
} from '../reportData';
import { FakeAdapter } from './fakeAdapter';
import type { EntryDoc } from '../../data/schema/entry';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const entryDoc = (over: Record<string, unknown> = {}): EntryDoc => ({
  type: 'expense', date: ts(100), amount: { minor: 5000, currency: 'INR' },
  category: 'Parking', attachments: [], uploaderUids: [],
  createdBy: 'u', createdByName: 'U', updatedBy: 'u',
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
});

let adapter: FakeAdapter;

beforeEach(() => {
  resetAppStore();
  resetFirebaseForTests();
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
});

afterEach(() => {
  stopReportEntryWatches();
});

const seed = (vid: string, n: number) => {
  for (let i = 0; i < n; i++) {
    adapter.docs.set(`vehicles/${vid}/entries/e${i}`, entryDoc({ date: ts(i) }));
  }
};

describe('shared selected-vehicle set (RPT-04 #1, PD-10)', () => {
  test('entriesForReport returns the shared watch set for the watched vehicle', () => {
    useAppStore.setState({
      entriesVehicleId: 'v1', entriesArrived: true,
      entries: [{ ...entryDoc(), id: 'e1', pending: false } as never],
      reportEntries: { v2: [{ ...entryDoc(), id: 'e2', pending: false } as never] },
      reportEntriesArrived: { v2: true },
    });
    expect(entriesForReport('v1').map((e) => e.id)).toEqual(['e1']);
    expect(entriesArrivedForReport('v1')).toBe(true);
    // a non-shared vehicle reads its own report cache instead
    expect(entriesForReport('v2').map((e) => e.id)).toEqual(['e2']);
    expect(entriesArrivedForReport('v3')).toBe(false);
  });

  test('syncing the watched vehicle adds NO extra watch', () => {
    useAppStore.setState({ entriesVehicleId: 'v1' });
    seed('v1', 2);
    syncReportEntryWatches(['v1']);
    // v1 is the shared set — it is skipped entirely, no listener subscribed
    expect(adapter.queryListeners.size).toBe(0);
    // and it doesn't gate the queue: a following vehicle still loads
    seed('v2', 1);
    syncReportEntryWatches(['v1', 'v2']);
    expect(useAppStore.getState().reportEntriesArrived['v2']).toBe(true);
    expect(useAppStore.getState().reportEntries['v2']).toHaveLength(1);
  });
});

describe('All-vehicles loads each vehicle in turn (RPT-04 #4, RPT-12)', () => {
  test('a second vehicle is not subscribed until the first arrives', async () => {
    const repos = getRepos();
    const calls: string[] = [];
    let heldNext: ((entries: import('../../data/repos/entryRepo').EntryRecord[]) => void) | null = null;
    const orig = repos.entries.watch.bind(repos.entries);
    jest.spyOn(repos.entries, 'watch').mockImplementation(
      ((vid: string, next: (entries: import('../../data/repos/entryRepo').EntryRecord[]) => void, limit?: number, opts?: Parameters<typeof orig>[3]) => {
        calls.push(vid);
        if (vid === 'v1') { heldNext = next; return () => undefined; }
        return orig(vid, next, limit, opts);
      }) as typeof repos.entries.watch,
    );
    seed('v2', 1);
    syncReportEntryWatches(['v1', 'v2']);
    expect(calls).toEqual(['v1']); // strictly one at a time
    heldNext!([]); // v1's first snapshot lands → v2 starts
    await Promise.resolve();
    expect(calls).toEqual(['v1', 'v2']);
    expect(useAppStore.getState().reportEntriesArrived['v2']).toBe(true);
  });

  test('a failed vehicle is skipped and reported; the rest still load', async () => {
    const repos = getRepos();
    const orig = repos.entries.watch.bind(repos.entries);
    jest.spyOn(repos.entries, 'watch').mockImplementation(
      ((vid: string, next: (entries: import('../../data/repos/entryRepo').EntryRecord[]) => void, limit?: number, opts?: Parameters<typeof orig>[3]) => {
        if (vid === 'v-bad') {
          opts?.onError?.(new RepoError('permission-denied'));
          return () => undefined;
        }
        return orig(vid, next, limit, opts);
      }) as typeof repos.entries.watch,
    );
    seed('v1', 2); seed('v2', 1);
    syncReportEntryWatches(['v1', 'v-bad', 'v2']);
    await Promise.resolve();
    const st = useAppStore.getState();
    expect(st.reportEntriesFailed['v-bad']).toBe(true);
    expect(reportEntriesFailed('v-bad')).toBe(true);
    expect(st.reportEntriesArrived['v1']).toBe(true);
    expect(st.reportEntriesArrived['v2']).toBe(true);
    expect(st.reportEntries['v2']).toHaveLength(1);
  });

  test('changes from another device reach the open screen via the listener', async () => {
    seed('v1', 1);
    syncReportEntryWatches(['v1']);
    await Promise.resolve();
    expect(useAppStore.getState().reportEntries['v1']).toHaveLength(1);
    adapter.setDoc('vehicles/v1/entries/new', entryDoc({}));
    expect(useAppStore.getState().reportEntries['v1']).toHaveLength(2);
  });

  test('re-syncing the same ids subscribes nothing new; leaving stops all', async () => {
    seed('v1', 1); seed('v2', 1);
    syncReportEntryWatches(['v1', 'v2']);
    await Promise.resolve();
    const listenerSets = [...adapter.queryListeners.values()];
    syncReportEntryWatches(['v1', 'v2']); // idempotent — no new watches
    expect([...adapter.queryListeners.values()].reduce((n, s) => n + s.size, 0))
      .toBe(listenerSets.reduce((n, s) => n + s.size, 0));
    stopReportEntryWatches();
    expect([...adapter.queryListeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});

describe('refresh (RPT-04 #6, FR-OFF-12)', () => {
  test('refreshReportEntries forces a server read per vehicle, in turn', async () => {
    seed('v1', 1); seed('v2', 2);
    const repos = getRepos();
    const calls: string[] = [];
    const orig = repos.entries.refresh.bind(repos.entries);
    jest.spyOn(repos.entries, 'refresh').mockImplementation(async (vid: string) => {
      calls.push(vid);
      return orig(vid);
    });
    await refreshReportEntries(['v1', 'v2']);
    expect(calls).toEqual(['v1', 'v2']);
    expect(useAppStore.getState().reportEntries['v1']).toHaveLength(1);
    expect(useAppStore.getState().reportEntries['v2']).toHaveLength(2);
  });

  test('a refresh failure marks that vehicle failed but keeps going', async () => {
    seed('v2', 2);
    const repos = getRepos();
    jest.spyOn(repos.entries, 'refresh').mockImplementation(async (vid: string) => {
      if (vid === 'v1') throw new RepoError('unavailable');
      return repos.entries.list(vid);
    });
    await refreshReportEntries(['v1', 'v2']);
    const st = useAppStore.getState();
    expect(st.reportEntriesFailed['v1']).toBe(true);
    expect(st.reportEntries['v2']).toHaveLength(2);
  });
});
