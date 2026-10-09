// Entries feature layer (LOG-04/11/13/14): the per-vehicle watch that feeds
// History and the forms, create/edit/delete write paths through `entryRepo`,
// edit/delete authority (LD-13) and the 5-second delete-with-Undo window
// (LD-12 — no write until the window lapses; backgrounding commits at once).

import { AppState } from 'react-native';
import type { Unsubscribe } from '../data/adapter';
import type { EntryInput, EntryPatch, EntryRecord } from '../data/repos/entryRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { useAppStore } from './appStore';
import { onEntriesSnapshot } from './reminders';
import { reportNonFatal } from './reporting';
import { getRepos } from './runtime';

export const DELETE_UNDO_MS = 5_000;

// --- watch (LOG-11) ----------------------------------------------------------

/**
 * Subscribe to all of the vehicle's entries (LD-10: one load, no paging) and
 * mirror them into the read model. Stale results from a previous vehicle are
 * ignored via `entriesVehicleId`.
 */
export function startEntriesWatch(vehicleId: string): Unsubscribe {
  useAppStore.setState({ entriesVehicleId: vehicleId, entriesArrived: false, entries: [] });
  return getRepos().entries.watch(
    vehicleId,
    (entries) => {
      const st = useAppStore.getState();
      if (st.entriesVehicleId !== vehicleId) return;
      useAppStore.setState({ entries, entriesArrived: true });
      // REM-03/06: an entry snapshot can complete reminders and changes the
      // prediction inputs, so the notification schedule rebuilds.
      onEntriesSnapshot(vehicleId);
    },
    undefined,
    {
      onError: (e) => {
        reportNonFatal(e, { stage: 'watch-entries' });
        useAppStore.setState({ ownerError: true });
      },
    },
  );
}

/** Pull-to-refresh — forces a server read (FR-OFF-12). */
export async function refreshEntries(vehicleId: string): Promise<void> {
  const fresh = await getRepos().entries.refresh(vehicleId);
  const st = useAppStore.getState();
  if (st.entriesVehicleId === vehicleId) {
    useAppStore.setState({ entries: fresh, entriesArrived: true });
  }
}

/** Entries minus the rows sitting in their Undo window. */
export function visibleEntries(
  entries: EntryRecord[],
  pendingDeletes: Record<string, unknown> = useAppStore.getState().pendingDeletes,
): EntryRecord[] {
  return entries.filter((e) => !pendingDeletes[e.id]);
}

// --- authority (LD-13) --------------------------------------------------------

/** Creator or vehicle owner edits; archived vehicles are read-only (DR-13). */
export function canEditEntry(
  entry: Pick<EntryRecord, 'createdBy'>,
  vehicle: VehicleRecord | null | undefined,
  uid?: string,
): boolean {
  if (!vehicle || vehicle.archived || !uid) return false;
  return entry.createdBy === uid || vehicle.ownerId === uid;
}

/** Delete authority is the same as edit authority (rules mirror it). */
export const canDeleteEntry = canEditEntry;

// --- writes -------------------------------------------------------------------

export async function createEntry(vehicleId: string, input: EntryInput): Promise<string> {
  return getRepos().entries.create(vehicleId, input);
}

export async function updateEntry(
  vehicleId: string,
  entryId: string,
  patch: EntryPatch,
): Promise<void> {
  return getRepos().entries.update(vehicleId, entryId, patch);
}

// --- delete with Undo (LD-12) ---------------------------------------------------

const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Hide the row and start the 5-second Undo window; the document is deleted
 * only when the window lapses. Returns false when the caller may not delete
 * the entry (LD-13 — UI mirrors the rules; other members' rows stay put).
 */
export function requestDelete(vehicleId: string, entry: EntryRecord): boolean {
  const st = useAppStore.getState();
  const vehicle = st.vehicles.find((v) => v.id === vehicleId);
  if (!canDeleteEntry(entry, vehicle, st.user?.uid)) return false;
  if (st.pendingDeletes[entry.id]) return true; // already in its window
  useAppStore.setState({
    pendingDeletes: {
      ...useAppStore.getState().pendingDeletes,
      [entry.id]: { vehicleId, entry },
    },
  });
  deleteTimers.set(
    entry.id,
    setTimeout(() => void commitDelete(entry.id), DELETE_UNDO_MS),
  );
  return true;
}

/** Undo inside the window: un-hide the row; nothing was ever written. */
export function undoDelete(entryId: string): void {
  const timer = deleteTimers.get(entryId);
  if (timer) {
    clearTimeout(timer);
    deleteTimers.delete(entryId);
  }
  const rest = { ...useAppStore.getState().pendingDeletes };
  delete rest[entryId];
  useAppStore.setState({ pendingDeletes: rest });
}

/**
 * Commit every pending delete at once — AppState 'background' (LD-12) and
 * session teardown. Failures surface through the write observer → Sync issues
 * (the rejected mutation is already rolled back server-side).
 */
export function commitPendingDeletes(): void {
  for (const id of Object.keys(useAppStore.getState().pendingDeletes)) {
    void commitDelete(id);
  }
}

async function commitDelete(entryId: string): Promise<void> {
  const timer = deleteTimers.get(entryId);
  if (timer) {
    clearTimeout(timer);
    deleteTimers.delete(entryId);
  }
  const pending = useAppStore.getState().pendingDeletes[entryId];
  if (!pending) return;
  const rest = { ...useAppStore.getState().pendingDeletes };
  delete rest[entryId];
  useAppStore.setState({ pendingDeletes: rest });
  try {
    await getRepos().entries.delete(pending.vehicleId, entryId);
  } catch (e) {
    // Refused (web has no durable queue): the row simply reappears — it was
    // only hidden. The write observer already filed a Sync issue.
    reportNonFatal(e, { stage: 'entry-delete' });
  }
}

/** Install the AppState listener once from `startSession`. */
export function installDeleteFlush(): Unsubscribe {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background') commitPendingDeletes();
  });
  return () => sub.remove();
}
