// Common props for the per-type entry forms (LOG-04..10). The dispatcher in
// app/entry/[type].tsx picks the form; `entry` present = edit mode.

import type { ReactNode } from 'react';
import type { EntryInput, EntryPatch, EntryRecord } from '../../data/repos/entryRepo';
import type { TemplateRecord } from '../../data/repos/templateRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';

/** New: `{ input }`; edit: `{ patch }` (null field values remove the field). */
export type EntryFormResult = { input: EntryInput } | { patch: EntryPatch };

export interface EntryFormProps {
  vehicle: VehicleRecord;
  entry?: EntryRecord;
  /** All of the vehicle's entries (odometer check, fuel defaults, mileage). */
  entries: EntryRecord[];
  /** New-entry prefill (REM-11): an amount-bearing reminder opens the Expense
   *  form with category and amount set; the date stays "now" (RD-10).
   *  `notes` pre-fills the notes field (CHK-08 "Log service" shortcut). */
  prefill?: { category?: string; amountMinor?: number; notes?: string };
  /** Inspection run: the template picked for this run (CHK-06). The form
   *  works from the copy captured at open, so template edits mid-run do not
   *  change it (CD-03). */
  template?: TemplateRecord;
  readOnly: boolean;
  saving?: boolean;
  /** Persist failure message from the write path, shown above Save. */
  saveError?: string | null;
  /** Receipt attachments UI (DRV-11), rendered above the notes field. */
  attachmentsNode?: ReactNode;
  onSubmit: (v: EntryFormResult) => void;
  onDelete?: () => void;
}
