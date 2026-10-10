// CHK-01 — checklist domain logic: starter templates by vehicle type (OQ-60,
// CD-02), template constraints (CD-01), the inspection snapshot with stable
// item ids and issueCount (Appendix E, CD-03), run rules (CD-04) and the
// copy/20-per-vehicle limits (OQ-59, CD-08). Pure functions only — no
// Firestore, no React.

import type { ChecklistTemplateDoc } from '../data/schema/checklistTemplate';
import type { InspectionDetailsDoc } from '../data/schema/entry';
import { MAX_TEMPLATE_ITEMS, SHORT_TEXT_MAX, NOTES_MAX } from '../data/schema/common';
import type { VehicleDoc } from '../data/schema/vehicle';

export const MAX_TEMPLATES_PER_VEHICLE = 20; // OQ-59 — app-side only (L17)

// --- item ids (CD-03) -------------------------------------------------------

/** Random per-item id, generated when the item is added (CD-03). */
export function newItemId(): string {
  return `i_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// --- starters (OQ-60, CD-02) -------------------------------------------------

export type StarterId = 'car_pretrip' | 'two_wheeler' | 'long_trip';
export const STARTER_IDS: readonly StarterId[] = ['car_pretrip', 'two_wheeler', 'long_trip'];

interface StarterSection {
  /** i18n key under checklists.starterGroups, undefined = ungrouped items. */
  groupKey?: string;
  /** i18n keys under checklists.starterItems. */
  itemKeys: string[];
}

/**
 * Starter item layout as i18n keys — CD-02: created from English i18n
 * strings. 'Documents (RC, insurance, PUC, licence)' is four items under a
 * 'Documents' group; other groups mirror the SRS wording (Tyres, Lights,
 * Fluids, Documents).
 */
const STARTER_LAYOUT: Record<StarterId, StarterSection[]> = {
  car_pretrip: [
    { groupKey: 'tyres', itemKeys: ['carPretrip.tyrePressure'] },
    { groupKey: 'lights', itemKeys: ['carPretrip.lights'] },
    { itemKeys: ['carPretrip.brakes', 'carPretrip.horn', 'carPretrip.wipers'] },
    { groupKey: 'fluids', itemKeys: ['carPretrip.engineOil', 'carPretrip.coolant', 'carPretrip.brakeFluid'] },
    { itemKeys: ['carPretrip.mirrors'] },
    { groupKey: 'documents', itemKeys: ['carPretrip.rc', 'carPretrip.insurance', 'carPretrip.puc', 'carPretrip.licence'] },
  ],
  two_wheeler: [
    { groupKey: 'tyres', itemKeys: ['twoWheeler.tyres'] },
    { itemKeys: ['twoWheeler.chain', 'twoWheeler.brakes', 'twoWheeler.lights', 'twoWheeler.horn', 'twoWheeler.mirrors', 'twoWheeler.fuel'] },
    { groupKey: 'documents', itemKeys: ['twoWheeler.documents'] },
  ],
  long_trip: [
    { groupKey: 'tyres', itemKeys: ['longTrip.spareTyre'] },
    { groupKey: 'kit', itemKeys: ['longTrip.toolkit', 'longTrip.firstAid'] },
    { groupKey: 'fluids', itemKeys: ['longTrip.fluids'] },
    { itemKeys: ['longTrip.battery', 'longTrip.ac', 'longTrip.fastag'] },
  ],
};

/**
 * Starters offered for a vehicle type (OQ-60): Car pre-trip + Long trip for
 * car/truck/bus/other; Two-wheeler + Long trip for bike/scooter. Any starter
 * may still be picked regardless of type.
 */
export function startersFor(vehicleType: VehicleDoc['type']): StarterId[] {
  return vehicleType === 'bike' || vehicleType === 'scooter'
    ? ['two_wheeler', 'long_trip']
    : ['car_pretrip', 'long_trip'];
}

/**
 * Build a starter template input from translated strings (CD-02: English
 * i18n text in v1). `tr` is the i18n t() function.
 */
export function starterInput(
  id: StarterId,
  tr: (key: string) => string,
): { name: string; items: ChecklistTemplateDoc['items'] } {
  const items: ChecklistTemplateDoc['items'] = [];
  for (const section of STARTER_LAYOUT[id]) {
    const group = section.groupKey ? tr(`checklists.starterGroups.${section.groupKey}`) : undefined;
    for (const key of section.itemKeys) {
      items.push({
        id: newItemId(),
        label: tr(`checklists.starterItems.${key}`),
        ...(group ? { group } : {}),
      });
    }
  }
  return { name: tr(`checklists.starters.${id}`), items };
}

// --- template constraints (CD-01) ---------------------------------------------

export type TemplateValidationError =
  | 'name-required'
  | 'name-too-long'
  | 'name-taken'
  | 'no-items'
  | 'too-many-items'
  | 'item-label'
  | 'item-group';

/**
 * CD-01: name 1–60 chars and unique per vehicle ignoring case; label and
 * group 1–60 chars; at least 1 item (the schema cap of 50 stays); reorder
 * and duplicate labels are allowed. `existingNames` are this vehicle's other
 * template names (the template's own name is excluded by the caller).
 */
export function validateTemplateInput(
  input: { name: string; items: { label: string; group?: string }[] },
  existingNames: string[] = [],
): TemplateValidationError | null {
  const name = input.name.trim();
  if (!name) return 'name-required';
  if (name.length > SHORT_TEXT_MAX) return 'name-too-long';
  const norm = name.toLowerCase();
  if (existingNames.some((n) => n.trim().toLowerCase() === norm)) return 'name-taken';
  if (input.items.length < 1) return 'no-items';
  if (input.items.length > MAX_TEMPLATE_ITEMS) return 'too-many-items';
  for (const i of input.items) {
    const label = i.label.trim();
    if (label.length < 1 || label.length > SHORT_TEXT_MAX) return 'item-label';
    if (i.group !== undefined) {
      const group = i.group.trim();
      if (group.length < 1 || group.length > SHORT_TEXT_MAX) return 'item-group';
    }
  }
  return null;
}

/** OQ-59: the app refuses the 21st template on a vehicle. */
export function canAddTemplate(count: number): boolean {
  return count < MAX_TEMPLATES_PER_VEHICLE;
}

// --- inspection snapshot (Appendix E, CD-03/CD-04) -----------------------------

export interface InspectionAnswer {
  /** Undefined while the run only has a note — stored as 'na' at save (CD-04). */
  result?: 'pass' | 'fail' | 'na';
  note?: string;
}

/**
 * Build the stored inspection snapshot from the template and the user's
 * answers. Item ids are the template's item ids (CD-03), so editing or
 * deleting the template later can never alter the saved inspection.
 * Unanswered items are stored as 'na' (CD-04 — the UI confirms first).
 */
export function buildInspection(
  template: Pick<ChecklistTemplateDoc, 'name' | 'items'>,
  answers: Map<string, InspectionAnswer>,
): InspectionDetailsDoc {
  const items = template.items.map((item) => {
    const a = answers.get(item.id);
    const out: InspectionDetailsDoc['items'][number] = {
      id: item.id,
      label: item.label,
      ...(item.group !== undefined ? { group: item.group } : {}),
      result: a?.result ?? 'na',
    };
    const note = a?.note?.trim();
    if (note) out.note = note;
    return out;
  });
  return {
    templateName: template.name,
    items,
    issueCount: items.filter((i) => i.result === 'fail').length,
  };
}

/** The failed items, for the post-save summary and the shortcut rows. */
export function failedItems(inspection: Pick<InspectionDetailsDoc, 'items'>): InspectionDetailsDoc['items'] {
  return inspection.items.filter((i) => i.result === 'fail');
}

/** CD-04: how many items still have no answer — the save-time confirmation. */
export function unansweredCount(
  items: { id: string }[],
  answers: Map<string, InspectionAnswer>,
): number {
  return items.filter((i) => !answers.get(i.id)?.result).length;
}

/** CD-04: an item note is up to 500 characters. */
export function noteTooLong(note: string): boolean {
  return note.length > NOTES_MAX;
}

// --- copy (CD-08) --------------------------------------------------------------

/**
 * CD-08: a copy keeps the same name; if it exists on the destination
 * ' (copy)' is appended, then ' (copy 2)', ' (copy 3)'. The 60-char cap is
 * kept by truncating the base name.
 */
export function copyNameFor(name: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const trimmed = name.trim();
  const fit = (suffix: string) => {
    const base = trimmed.slice(0, Math.max(1, SHORT_TEXT_MAX - suffix.length));
    return `${base}${suffix}`;
  };
  if (!taken.has(trimmed.toLowerCase()) && trimmed.length <= SHORT_TEXT_MAX) return trimmed;
  let n = 0;
  for (;;) {
    const suffix = n === 0 ? ' (copy)' : ` (copy ${n + 1})`;
    const candidate = fit(suffix);
    if (!taken.has(candidate.toLowerCase())) return candidate;
    n += 1;
  }
}

/** The copy's items: same labels and groups, fresh item ids (CD-08). */
export function copyTemplateItems(items: ChecklistTemplateDoc['items']): ChecklistTemplateDoc['items'] {
  return items.map((i) => ({
    id: newItemId(),
    label: i.label,
    ...(i.group !== undefined ? { group: i.group } : {}),
  }));
}

// --- failed-item shortcuts (CD-07) ----------------------------------------------

/** CD-07: the pre-filled reminder title '<item label> — <vehicle name>'. */
export function reminderTitleFor(itemLabel: string, vehicleName: string): string {
  return `${itemLabel} — ${vehicleName}`;
}

// --- history badge (CD-09) -------------------------------------------------------

/** Badge text key for the issue count: plural 'issues', 'No issues' at 0. */
export function issuesBadge(count: number, tr: (key: string, opts?: Record<string, unknown>) => string): string {
  return count === 0
    ? tr('checklists.noIssues')
    : tr('checklists.issues', { count });
}
