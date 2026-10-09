// Report entry cache (RPT-04, PD-10). The selected vehicle reuses the shared
// watch in `state.entries` — Reports, History and Dashboard all read one
// loaded set, so opening a report costs zero extra reads. "All vehicles"
// watches each other vehicle once and keeps the sets in `reportEntries`;
// vehicles are loaded strictly in turn and a failure skips that vehicle with
// a per-vehicle notice. Watches stay live while a report is open so changes
// from another device or member stream in. Malformed documents are skipped
// by the repo and surface through the shared skipped-docs notice (DR-08).

import type { Unsubscribe } from '../data/adapter';
import type { EntryRecord } from '../data/repos/entryRepo';
import { useAppStore } from './appStore';
import { reportNonFatal } from './reporting';
import { getRepos } from './runtime';

const stops = new Map<string, Unsubscribe>();
let wanted: string[] = [];

/** True when the shared selected-vehicle watch already covers this id. */
const isShared = (vehicleId: string): boolean =>
  useAppStore.getState().entriesVehicleId === vehicleId;

/** Entries for a report scope: the shared set for the selected vehicle,
 *  its own report cache otherwise. */
export function entriesForReport(vehicleId: string): EntryRecord[] {
  const st = useAppStore.getState();
  return isShared(vehicleId) ? st.entries : st.reportEntries[vehicleId] ?? [];
}

export function entriesArrivedForReport(vehicleId: string): boolean {
  const st = useAppStore.getState();
  return isShared(vehicleId) ? st.entriesArrived : st.reportEntriesArrived[vehicleId] === true;
}

export function reportEntriesFailed(vehicleId: string): boolean {
  return useAppStore.getState().reportEntriesFailed[vehicleId] === true;
}

/**
 * Keep report watches aligned with the wanted vehicle list. The shared
 * vehicle is skipped (its own session watch already loads it — RPT-04 #1).
 * Call again whenever the list or the shared vehicle changes; idempotent.
 */
export function syncReportEntryWatches(vehicleIds: string[]): void {
  wanted = [...vehicleIds];
  const wantedSet = new Set(vehicleIds);
  const st = useAppStore.getState();
  for (const [vid, stop] of [...stops]) {
    if (!wantedSet.has(vid) || vid === st.entriesVehicleId) {
      stop();
      stops.delete(vid);
    }
  }
  pump();
}

/** Stop every report watch — report screen unmount and session teardown. */
export function stopReportEntryWatches(): void {
  for (const stop of stops.values()) stop();
  stops.clear();
  wanted = [];
}

/** Load strictly one vehicle at a time (RPT-04 #4). */
function pump(): void {
  const st = useAppStore.getState();
  for (const vid of wanted) {
    if (stops.has(vid) && !st.reportEntriesArrived[vid] && !st.reportEntriesFailed[vid]) return;
  }
  for (const vid of wanted) {
    if (vid === st.entriesVehicleId) continue;
    if (stops.has(vid) || st.reportEntriesArrived[vid] || st.reportEntriesFailed[vid]) continue;
    stops.set(
      vid,
      getRepos().entries.watch(
        vid,
        (entries) => {
          const cur = useAppStore.getState();
          useAppStore.setState({
            reportEntries: { ...cur.reportEntries, [vid]: entries },
            reportEntriesArrived: { ...cur.reportEntriesArrived, [vid]: true },
          });
          pump();
        },
        undefined,
        {
          onError: (e) => {
            reportNonFatal(e, { stage: 'watch-report-entries', id: vid });
            const cur = useAppStore.getState();
            useAppStore.setState({
              reportEntriesFailed: { ...cur.reportEntriesFailed, [vid]: true },
            });
            stops.delete(vid);
            pump();
          },
        },
      ),
    );
    return;
  }
}

/** Pull-to-refresh — a forced server read per vehicle, in turn (FR-OFF-12). */
export async function refreshReportEntries(vehicleIds: string[]): Promise<void> {
  for (const vid of vehicleIds) {
    if (isShared(vid)) continue; // the shared set has its own refreshEntries
    try {
      const fresh = await getRepos().entries.refresh(vid);
      const cur = useAppStore.getState();
      useAppStore.setState({
        reportEntries: { ...cur.reportEntries, [vid]: fresh },
        reportEntriesArrived: { ...cur.reportEntriesArrived, [vid]: true },
        reportEntriesFailed: { ...cur.reportEntriesFailed, [vid]: false },
      });
    } catch (e) {
      reportNonFatal(e, { stage: 'refresh-report-entries', id: vid });
      const cur = useAppStore.getState();
      useAppStore.setState({
        reportEntriesFailed: { ...cur.reportEntriesFailed, [vid]: true },
      });
    }
  }
}
