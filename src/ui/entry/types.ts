// Common props for the per-type entry forms (LOG-04..10). The dispatcher in
// app/entry/[type].tsx picks the form; `entry` present = edit mode.

import type { EntryInput, EntryPatch, EntryRecord } from '../../data/repos/entryRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';

/** New: `{ input }`; edit: `{ patch }` (null field values remove the field). */
export type EntryFormResult = { input: EntryInput } | { patch: EntryPatch };

export interface EntryFormProps {
  vehicle: VehicleRecord;
  entry?: EntryRecord;
  /** All of the vehicle's entries (odometer check, fuel defaults, mileage). */
  entries: EntryRecord[];
  readOnly: boolean;
  saving?: boolean;
  /** Persist failure message from the write path, shown above Save. */
  saveError?: string | null;
  onSubmit: (v: EntryFormResult) => void;
  onDelete?: () => void;
}
