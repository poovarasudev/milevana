// DRV-09/10 screen coverage: the restore flow lists Drive backups (latest
// preselected first), shows the per-vehicle review (missing / differs / same
// / not-yours) with Keep/Replace chips, runs the write plan with progress and
// ends on the summary card.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { setFirebaseFactory, resetFirebaseForTests } from '../../src/data/firebase';
import { resetDriveForTests, setDriveFactory } from '../../src/data/drive/client';
import { BACKUP_FORMAT_VERSION, docToJson, type BackupDocument, type BackupVehicleJson } from '../../src/data/drive/backupFile';
import { ensureDriveLayout } from '../../src/data/drive/folders';
import { resetRuntimeForTests, getRepos } from '../../src/features/runtime';
import { resetAppStore, useAppStore } from '../../src/features/appStore';
import { localFlags } from '../../src/data/localFlags';
import { initI18n } from '../../src/i18n';
import { FakeAdapter } from '../../src/features/__tests__/fakeAdapter';
import { FakeDriveClient } from '../../src/features/__tests__/fakeDrive';
import type { VehicleDoc } from '../../src/data/schema/vehicle';
import type { EntryDoc } from '../../src/data/schema/entry';
import Restore from '../restore';

const uid = 'me';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

// See attachments.test.tsx — invoking the mapped handler directly avoids
// RTL v14 act() overlap.
function press(el: TestInstance): void {
  let cur: TestInstance | null = el;
  while (cur && typeof cur.props.onClick !== 'function' && typeof cur.props.onPress !== 'function') {
    cur = cur.parent;
  }
  const fn = cur?.props.onClick ?? cur?.props.onPress;
  if (typeof fn !== 'function') throw new Error('no pressable element/ancestor');
  fn();
}
let adapter: FakeAdapter;
let drive: FakeDriveClient;

const vehicleDoc = (over: Record<string, unknown> = {}): VehicleDoc => ({
  name: 'Old Car', type: 'car', color: 'c01', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  lastOdometer: 0, lastOdometerAt: ts(1), archived: false,
  ownerId: uid, memberIds: [uid],
  members: { [uid]: { role: 'owner', name: 'Me', joinedAt: ts(1) } },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(9),
  ...over,
} as VehicleDoc);

const entryDoc = (over: Record<string, unknown> = {}): EntryDoc => ({
  type: 'expense', date: ts(100), odometer: 1200,
  amount: { minor: 5000, currency: 'INR' }, category: 'cleaning',
  attachments: [], uploaderUids: [uid],
  createdBy: uid, createdByName: 'Me', updatedBy: uid,
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(3),
  ...over,
} as EntryDoc);

function backupVehicle(id: string, doc: VehicleDoc, entries: ({ id: string } & EntryDoc)[] = []): BackupVehicleJson {
  const { members, ...rest } = doc;
  return {
    id,
    doc: docToJson(rest as Record<string, unknown>),
    members: Object.entries(members).map(([muid, m]) => ({ uid: muid, ...(m.name ? { name: m.name } : {}), role: m.role })),
    entries: entries.map(({ id: eid, ...e }) => ({ id: eid, doc: docToJson(e as Record<string, unknown>) })),
    reminders: [],
    checklistTemplates: [],
  };
}

async function plantBackup(vehicles: BackupVehicleJson[], name = 'milevana-backup-2024-01-01.json'): Promise<string> {
  const doc: BackupDocument = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date(2024, 0, 1).toISOString(),
    kind: 'manual',
    app: { name: 'Milevana', version: '1.0.0' },
    vehicles,
  };
  const layout = await ensureDriveLayout(uid, getRepos());
  return drive.plant(name, layout.backupsFolderId, { text: JSON.stringify(doc) }).id;
}

beforeAll(() => initI18n('en'));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetFirebaseForTests();
  resetDriveForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Me', email: 'me@x.com' };
  setFirebaseFactory(() => adapter);
  drive = new FakeDriveClient();
  setDriveFactory(() => drive);
  await getRepos().users.ensureUser(uid, { isLinked: true });
  await localFlags.setBool(uid, 'driveGranted', true);
  useAppStore.setState({ user: adapter.user, online: true });
});

describe('Restore screen (DRV-09/10)', () => {
  it('lists backups and restores a missing vehicle end to end', async () => {
    await plantBackup([backupVehicle('v-old', vehicleDoc({ name: 'Old Car' }), [{ id: 'e1', ...entryDoc({}) }])]);
    const q = await render(<Restore />);
    const row = await q.findByText('2024-01-01');
    press(row);
    // review: 'Old Car' is missing → will be restored
    await q.findByText('Old Car');
    q.getByText('Will be restored');
    press(q.getAllByText('Restore').at(-1)!);
    await q.findByText('Restore complete');
    expect(q.getByText(/1 restored · 0 kept · 0 skipped/)).toBeTruthy();
    // data actually landed
    const v = await getRepos().vehicles.get('v-old');
    expect(v!.name).toBe('Old Car');
    expect(v!.lastOdometer).toBe(1200); // recomputed from restored entries
    expect((await getRepos().entries.list('v-old'))).toHaveLength(1);
  });

  it('shows the empty state when there are no backups', async () => {
    const q = await render(<Restore />);
    await q.findByText('No backups yet');
  });

  it('differs rows get Keep current / Replace with backup chips (SC-DRV09)', async () => {
    adapter.setDoc('vehicles/v-same', vehicleDoc({ name: 'Swift' }));
    await plantBackup([backupVehicle('v-same', vehicleDoc({ name: 'Swift Sport' }))]);
    const q = await render(<Restore />);
    press(await q.findByText('2024-01-01'));
    await q.findByText('Differs from backup');
    q.getByText('Keep current');
    press(q.getByText('Replace with backup'));
    await act(async () => { await Promise.resolve(); });
    press(q.getAllByText('Restore').at(-1)!);
    await q.findByText('Restore complete');
    expect((await getRepos().vehicles.get('v-same'))!.name).toBe('Swift Sport');
  });
});
