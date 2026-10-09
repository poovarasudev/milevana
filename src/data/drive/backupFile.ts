// Drive backup file format (DRV-06): readable JSON, one file per backup.
//   milevana-backup-YYYY-MM-DD-HHMM.json  → kind manual|automatic
// The file carries only owned vehicles (PRD §15/ED-04), members without
// emails ({uid, name, role}), entry attachments with sharedWithUids emptied,
// and a settings subset — no Drive metadata, no muted-vehicle ids, no
// deletion markers. Vehicles owned by someone else are never written.
// This is a portability format distinct from the export bundle in
// data/serializer.ts; restore.ts drives the same repo batching rules.

import type { UserDoc } from '../schema/user';
import type { VehicleDoc } from '../schema/vehicle';
import type { EntryDoc } from '../schema/entry';
import type { ReminderDoc } from '../schema/reminder';
import type { ChecklistTemplateDoc } from '../schema/checklistTemplate';

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_FILE_PREFIX = 'milevana-backup-';
export const BACKUP_APP_NAME = 'Milevana';
export type BackupKind = 'manual' | 'automatic';

export class BackupFileError extends Error {
  code: 'not-json' | 'not-backup' | 'unsupported-version';
  constructor(code: BackupFileError['code'], detail?: string) {
    super(`backup ${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'BackupFileError';
    this.code = code;
  }
}

// ---- doc ↔ JSON -----------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && (v.constructor === Object || !v.constructor);

/** Doc timestamps are plain {seconds, nanoseconds} objects (schema/common). */
const isTimestampJson = (v: Record<string, unknown>): v is { seconds: number; nanoseconds: number } =>
  typeof v.seconds === 'number' &&
  typeof v.nanoseconds === 'number' &&
  Object.keys(v).every((k) => k === 'seconds' || k === 'nanoseconds');

function toJsonValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(toJsonValue);
  if (isPlainObject(v)) {
    if (isTimestampJson(v)) return { seconds: v.seconds, nanoseconds: v.nanoseconds };
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) out[k] = toJsonValue(val);
    return out;
  }
  return v;
}

function fromJsonValue(v: unknown): unknown {
  if (isPlainObject(v) && isTimestampJson(v)) return { seconds: v.seconds, nanoseconds: v.nanoseconds };
  if (Array.isArray(v)) return v.map(fromJsonValue);
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = fromJsonValue(val);
    return out;
  }
  return v;
}

export const docToJson = (doc: Record<string, unknown>): Record<string, unknown> =>
  toJsonValue(doc) as Record<string, unknown>;
export const docFromJson = (json: Record<string, unknown>): Record<string, unknown> =>
  fromJsonValue(json) as Record<string, unknown>;

// ---- file types -----------------------------------------------------------

export type BackupDocJson = Record<string, unknown>;

/** Settings subset per ED-04 — no muted vehicle ids, no drive/deletion data. */
export interface BackupSettingsJson {
  currency: string;
  distanceUnit: string;
  volumeUnit: string;
  efficiencyFormat: string;
  dateFormat: string;
  theme: string;
  locale: string;
  backupFrequency: string;
}

/** Members as portable identities: {uid, name, role} — never email (ED-04). */
export interface BackupMemberJson {
  uid: string;
  name?: string;
  role: string;
}

export interface BackupVehicleJson {
  id: string;
  doc: BackupDocJson; // VehicleDoc minus members
  members: BackupMemberJson[];
  entries: { id: string; doc: BackupDocJson }[];
  reminders: { id: string; doc: BackupDocJson }[];
  checklistTemplates: { id: string; doc: BackupDocJson }[];
}

export interface BackupDocument {
  formatVersion: number;
  createdAt: string; // ISO 8601
  kind: BackupKind;
  app: { name: typeof BACKUP_APP_NAME; version: string };
  settings?: BackupSettingsJson;
  vehicles: BackupVehicleJson[];
}

// ---- write ----------------------------------------------------------------

export interface BackupSource {
  user: UserDoc;
  /** owned vehicles only — callers must exclude member-only vehicles */
  vehicles: ({ id: string } & VehicleDoc)[];
  entriesByVehicle: Record<string, ({ id: string } & EntryDoc)[]>;
  remindersByVehicle: Record<string, ({ id: string } & ReminderDoc)[]>;
  templatesByVehicle: Record<string, ({ id: string } & ChecklistTemplateDoc)[]>;
  kind: BackupKind;
  appVersion: string;
  now?: Date;
}

function memberJson(members: VehicleDoc['members']): BackupMemberJson[] {
  return Object.entries(members).map(([uid, m]) => ({
    uid,
    ...(m.name ? { name: m.name } : {}),
    role: m.role,
  }));
}

function settingsJson(s: UserDoc['settings']): BackupSettingsJson {
  return {
    currency: s.currency,
    distanceUnit: s.distanceUnit,
    volumeUnit: s.volumeUnit,
    efficiencyFormat: s.efficiencyFormat,
    dateFormat: s.dateFormat,
    theme: s.theme,
    locale: s.locale,
    backupFrequency: s.backupFrequency,
  };
}

function vehicleDocJson(v: VehicleDoc): BackupDocJson {
  const { members: _members, ...rest } = v;
  void _members;
  return docToJson(rest);
}

function entryDocJson(doc: EntryDoc): BackupDocJson {
  const j = docToJson(doc as Record<string, unknown>);
  if (Array.isArray(j.attachments)) {
    // Shared visibility is current state, not portable identity (PRD §15).
    j.attachments = (j.attachments as BackupDocJson[]).map((a) => ({ ...a, sharedWithUids: [] }));
  }
  return j;
}

/** Serialize the signed-in owner's data into a BackupDocument (DRV-06). */
export function buildBackupDocument(src: BackupSource): BackupDocument {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: (src.now ?? new Date()).toISOString(),
    kind: src.kind,
    app: { name: BACKUP_APP_NAME, version: src.appVersion },
    settings: settingsJson(src.user.settings),
    vehicles: src.vehicles.map(({ id, ...doc }) => ({
      id,
      doc: vehicleDocJson(doc),
      members: memberJson(doc.members),
      entries: (src.entriesByVehicle[id] ?? []).map(({ id: eid, ...edoc }) => ({
        id: eid,
        doc: entryDocJson(edoc as EntryDoc),
      })),
      reminders: (src.remindersByVehicle[id] ?? []).map(({ id: rid, ...rdoc }) => ({
        id: rid,
        doc: docToJson(rdoc as Record<string, unknown>),
      })),
      checklistTemplates: (src.templatesByVehicle[id] ?? []).map(({ id: tid, ...tdoc }) => ({
        id: tid,
        doc: docToJson(tdoc as Record<string, unknown>),
      })),
    })),
  };
}

/** `milevana-backup-YYYY-MM-DD-HHMM.json` in device local time (DRV-06). */
export function backupFileName(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${BACKUP_FILE_PREFIX}${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}.json`
  );
}

// ---- read -----------------------------------------------------------------

function asRecord(v: unknown): BackupDocJson | null {
  return isPlainObject(v) ? (v as BackupDocJson) : null;
}

function validMembers(v: unknown): v is BackupMemberJson[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        isPlainObject(m) &&
        typeof m.uid === 'string' &&
        typeof m.role === 'string' &&
        (m.name === undefined || typeof m.name === 'string'),
    )
  );
}

function validIdDocs(v: unknown): v is { id: string; doc: BackupDocJson }[] {
  return (
    Array.isArray(v) &&
    v.every((e) => isPlainObject(e) && typeof e.id === 'string' && !!asRecord(e.doc))
  );
}

/** Parse and validate a backup file; throws BackupFileError (DRV-06/ED-05). */
export function readBackupFile(text: string): BackupDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFileError('not-json');
  }
  const j = asRecord(raw);
  if (!j) throw new BackupFileError('not-backup');
  if (typeof j.formatVersion !== 'number') throw new BackupFileError('not-backup', 'formatVersion');
  if (j.formatVersion > BACKUP_FORMAT_VERSION) {
    // ED-05: a newer file means a newer app wrote it — tell the user to update.
    throw new BackupFileError('unsupported-version', `formatVersion=${j.formatVersion}`);
  }
  // v1 is the only released format; older files would migrate here.
  const app = asRecord(j.app);
  if (!app || app.name !== BACKUP_APP_NAME) throw new BackupFileError('not-backup', 'app');
  if (j.kind !== 'manual' && j.kind !== 'automatic') throw new BackupFileError('not-backup', 'kind');
  if (typeof j.createdAt !== 'string') throw new BackupFileError('not-backup', 'createdAt');
  if (!Array.isArray(j.vehicles)) throw new BackupFileError('not-backup', 'vehicles');
  for (const v of j.vehicles as unknown[]) {
    const vv = asRecord(v);
    if (!vv || typeof vv.id !== 'string' || !asRecord(vv.doc)) {
      throw new BackupFileError('not-backup', 'vehicle');
    }
    if (!validMembers(vv.members) || !validIdDocs(vv.entries) || !validIdDocs(vv.reminders)) {
      throw new BackupFileError('not-backup', `vehicle ${vv.id}`);
    }
    if (!validIdDocs(vv.checklistTemplates)) {
      throw new BackupFileError('not-backup', `templates ${vv.id}`);
    }
  }
  return j as unknown as BackupDocument;
}
