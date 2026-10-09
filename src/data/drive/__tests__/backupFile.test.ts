// DRV-06 (SC-DRV06-01..03): file name pattern, top-level fields, owned-only
// scope, members without emails, the settings subset, sharedWithUids emptied,
// round trip, and the read errors (not-json / not-backup / unsupported-version).

import {
  BackupFileError,
  backupFileName,
  buildBackupDocument,
  readBackupFile,
} from '../backupFile';
import type { UserDoc } from '../../schema/user';
import type { VehicleDoc } from '../../schema/vehicle';
import type { EntryDoc } from '../../schema/entry';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const user: UserDoc = {
  displayName: 'Owner',
  email: 'owner@example.com',
  isLinked: true,
  settings: {
    currency: 'INR', distanceUnit: 'km', volumeUnit: 'litres',
    efficiencyFormat: 'km_per_l', dateFormat: 'DD/MM/YYYY', theme: 'system',
    locale: 'en-IN', backupFrequency: 'weekly', mutedReminderVehicleIds: ['v9'],
  },
  drive: { rootFolderId: 'r', vehicleFolderIds: {} },
  createdAt: ts(1),
  schemaVersion: 1,
};

const vehicle = (id: string, over: Record<string, unknown> = {}): ({ id: string } & VehicleDoc) => ({
  id,
  name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', startOdometer: 100,
  lastOdometer: 1200, lastOdometerAt: ts(50), archived: false,
  ownerId: 'u-owner',
  memberIds: ['u-owner', 'u-member'],
  members: {
    'u-owner': { role: 'owner', name: 'Owner', joinedAt: ts(1) },
    'u-member': { role: 'member', name: 'Member', joinedAt: ts(2) },
  },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(9),
  ...over,
} as { id: string } & VehicleDoc);

const entry = (id: string, over: Record<string, unknown> = {}): ({ id: string } & EntryDoc) => ({
  id,
  type: 'fuel', date: ts(100), odometer: 1200,
  amount: { minor: 5000, currency: 'INR' },
  attachments: [{
    id: 'a1', ownerUid: 'u-owner', mimeType: 'image/jpeg', sizeBytes: 10,
    status: 'uploaded', driveFileId: 'df1', sharedWithUids: ['u-member'],
  }],
  uploaderUids: ['u-owner'],
  details: { fuelType: 'petrol', quantity: 10, quantityUnit: 'litres', pricePerUnitMilli: 50000, fullTank: true },
  createdBy: 'u-owner', createdByName: 'Owner', updatedBy: 'u-owner',
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(3),
  ...over,
} as { id: string } & EntryDoc);

describe('backupFileName', () => {
  it('follows milevana-backup-YYYY-MM-DD-HHMM.json (SC-DRV06-01)', () => {
    expect(backupFileName(new Date(2024, 2, 5, 9, 7))).toBe('milevana-backup-2024-03-05-0907.json');
    expect(backupFileName(new Date(2024, 11, 31, 23, 59))).toMatch(/^milevana-backup-2024-12-31-2359\.json$/);
  });
});

describe('buildBackupDocument', () => {
  it('has formatVersion 1, createdAt, kind, app and settings (SC-DRV06-01)', () => {
    const doc = buildBackupDocument({
      user, vehicles: [vehicle('v1')],
      entriesByVehicle: { v1: [entry('e1')] },
      remindersByVehicle: {}, templatesByVehicle: {},
      kind: 'manual', appVersion: '1.0.0', now: new Date(2024, 0, 1),
    });
    expect(doc.formatVersion).toBe(1);
    expect(doc.kind).toBe('manual');
    expect(doc.app).toEqual({ name: 'Milevana', version: '1.0.0' });
    expect(doc.createdAt).toBe(new Date(2024, 0, 1).toISOString());
    expect(doc.vehicles).toHaveLength(1);
  });

  it('members carry no email; settings hold only the listed keys; sharedWithUids emptied (SC-DRV06-02)', () => {
    const doc = buildBackupDocument({
      user, vehicles: [vehicle('v1')],
      entriesByVehicle: { v1: [entry('e1')] },
      remindersByVehicle: {}, templatesByVehicle: {},
      kind: 'manual', appVersion: '1.0.0',
    });
    const bv = doc.vehicles[0];
    expect(bv.members).toEqual([
      { uid: 'u-owner', name: 'Owner', role: 'owner' },
      { uid: 'u-member', name: 'Member', role: 'member' },
    ]);
    expect(JSON.stringify(bv.members)).not.toContain('@');
    expect(Object.keys(doc.settings!)).toEqual([
      'currency', 'distanceUnit', 'volumeUnit', 'efficiencyFormat',
      'dateFormat', 'theme', 'locale', 'backupFrequency',
    ]);
    const att = (bv.entries[0].doc.attachments as Record<string, unknown>[])[0];
    expect(att.sharedWithUids).toEqual([]);
    expect(att.driveFileId).toBe('df1');
    expect(bv.entries[0].doc.uploaderUids).toEqual(['u-owner']);
    // vehicle doc keeps no members map (they live in bv.members)
    expect(bv.doc.members).toBeUndefined();
    expect(bv.doc.startOdometer).toBe(100);
  });

  it('round trips a vehicle with entries, reminders and templates (SC-DRV06-03)', () => {
    const entries = Array.from({ length: 12 }, (_, i) => entry(`e${i}`, { odometer: 1000 + i }));
    const doc = buildBackupDocument({
      user, vehicles: [vehicle('v1'), vehicle('v2', { name: 'Bike', type: 'bike' })],
      entriesByVehicle: { v1: entries },
      remindersByVehicle: {
        v1: [{ id: 'r1', title: 'Insurance', vehicleId: 'v1', done: false, createdBy: 'u-owner',
          updatedBy: 'u-owner', schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
          subject: { kind: 'expense', category: 'insurance' },
          dateTrigger: { dueDate: ts(200), repeatMonths: 0, leadDays: 3 } } as never],
      },
      templatesByVehicle: {},
      kind: 'automatic', appVersion: '1.0.0',
    });
    const text = JSON.stringify(doc);
    const back = readBackupFile(text);
    expect(back.kind).toBe('automatic');
    expect(back.vehicles).toHaveLength(2);
    const v1 = back.vehicles.find((v) => v.id === 'v1')!;
    expect(v1.entries).toHaveLength(12);
    expect(v1.entries[3].doc.odometer).toBe(1003);
    expect(v1.reminders).toHaveLength(1);
    // timestamps survive as plain {seconds, nanoseconds} objects
    expect(v1.entries[0].doc.date).toEqual({ seconds: 100, nanoseconds: 0 });
  });
});

describe('readBackupFile errors (ED-05)', () => {
  it('not-json for unparseable text', () => {
    expect(() => readBackupFile('not json {')).toThrowError(BackupFileError);
    try { readBackupFile('{'); } catch (e) { expect((e as BackupFileError).code).toBe('not-json'); }
  });
  it('not-backup for wrong shape or app name', () => {
    for (const bad of ['42', '{}', JSON.stringify({ formatVersion: 1, app: { name: 'Other' } })]) {
      try { readBackupFile(bad); fail('should throw'); }
      catch (e) { expect((e as BackupFileError).code).toBe('not-backup'); }
    }
  });
  it('unsupported-version for a newer formatVersion', () => {
    const doc = buildBackupDocument({
      user, vehicles: [], entriesByVehicle: {}, remindersByVehicle: {},
      templatesByVehicle: {}, kind: 'manual', appVersion: '1',
    });
    const text = JSON.stringify({ ...doc, formatVersion: 99 });
    try { readBackupFile(text); fail('should throw'); }
    catch (e) { expect((e as BackupFileError).code).toBe('unsupported-version'); }
  });
  it('accepts an older formatVersion (upgraded on read)', () => {
    const doc = buildBackupDocument({
      user, vehicles: [], entriesByVehicle: {}, remindersByVehicle: {},
      templatesByVehicle: {}, kind: 'manual', appVersion: '1',
    });
    const back = readBackupFile(JSON.stringify({ ...doc, formatVersion: 0 }));
    expect(back.formatVersion).toBe(0);
    expect(back.vehicles).toEqual([]);
  });
});
