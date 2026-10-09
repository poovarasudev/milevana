// DRV-07/15/16 screen coverage: anonymous sees the link card but CSV export
// still works without Google (SC-DRV16-01); a linked user without the Drive
// grant sees the explanation + Allow; granted users see last-backup state,
// Back up now, the backup list with Delete, and the Restore row. The Drive
// client is faked — real OAuth is owner-only.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { fireEvent, render } from '@testing-library/react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../src/data/firebase';
import { resetDriveForTests, setDriveFactory } from '../../src/data/drive/client';
import { resetShareOutForTests, setShareOutFactory } from '../../src/data/shareOut';
import { resetRuntimeForTests, getRepos } from '../../src/features/runtime';
import { resetAppStore, useAppStore } from '../../src/features/appStore';
import { localFlags } from '../../src/data/localFlags';
import { runBackup } from '../../src/features/backup';
import { initI18n } from '../../src/i18n';
import { FakeAdapter } from '../../src/features/__tests__/fakeAdapter';
import { FakeDriveClient } from '../../src/features/__tests__/fakeDrive';
import BackupExport from '../backup-export';

const uid = 'me';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
let adapter: FakeAdapter;
let drive: FakeDriveClient;
let shared: { fileName: string; text: string }[];

async function wireUser(linked: boolean) {
  adapter.user = { uid, isAnonymous: !linked, displayName: 'Me', email: linked ? 'me@x.com' : null };
  await getRepos().users.ensureUser(uid, { isLinked: linked });
  const userDoc = await getRepos().users.getUser(uid);
  useAppStore.setState({
    user: adapter.user,
    userDoc: userDoc as never,
    vehicles: [],
    vehiclesLoaded: true,
    online: true,
  });
}

beforeAll(() => initI18n('en'));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetFirebaseForTests();
  resetDriveForTests();
  resetShareOutForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Me', email: 'me@x.com' };
  setFirebaseFactory(() => adapter);
  drive = new FakeDriveClient();
  setDriveFactory(() => drive);
  shared = [];
  setShareOutFactory(() => ({
    shareText: async (fileName: string, text: string) => { shared.push({ fileName, text }); return true; },
  }));
  jest.clearAllMocks();
});

async function seedEntry() {
  const vid = await getRepos().vehicles.create({
    name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  });
  await getRepos().entries.create(vid, {
    type: 'expense', date: ts(Math.floor(Date.now() / 1000)), amount: { minor: 5000, currency: 'INR' }, category: 'Parking',
  });
  return vid;
}

describe('Backup & export screen (DRV-16)', () => {
  it('anonymous user: link card shown, CSV export still works (SC-DRV16-01)', async () => {
    await wireUser(false);
    await seedEntry();
    const q = await render(<BackupExport />);
    q.getByText('Link Google to back up');
    // CSV export needs no Google/Drive (ED-12/SC-DRV16-01)
    fireEvent.press(q.getByText('Export CSV'));
    await q.findByText('CSV exported');
    expect(shared).toHaveLength(1);
    expect(shared[0].fileName).toMatch(/^milevana-export-.*\.csv$/);
    expect(shared[0].text).toContain('vehicle');
    expect(shared[0].text).toContain('Swift');
  });

  it('linked user without grant sees the explanation and Allow Drive access (ED-02)', async () => {
    await wireUser(true);
    await seedEntry();
    const q = await render(<BackupExport />);
    await q.findByText('Backups live in your Google Drive');
    fireEvent.press(q.getByText('Allow Drive access'));
    await q.findByText('Back up now'); // granted → working state
    // The incremental-consent call ran (drive.file scope only — in the client).
    expect(drive.accessHints.length).toBe(1);
  });

  it('granted user: Back up now uploads and lists the manual backup (SC-DRV07)', async () => {
    await wireUser(true);
    await seedEntry();
    await localFlags.setBool(uid, 'driveGranted', true);
    const q = await render(<BackupExport />);
    await q.findByText('No backups yet');
    fireEvent.press(q.getByText('Back up now'));
    await q.findByText(/milevana-backup|No backups/, { exact: false });
    // backup landed in Drive and the user doc recorded it
    const up = drive.uploads.find((u) => u.name.startsWith('milevana-backup-'));
    expect(up).toBeTruthy();
    expect(up!.mimeType).toBe('application/json');
    const userDoc = (await getRepos().users.getUser(uid))!;
    expect(userDoc.drive?.lastBackupAt).toBeTruthy();
  });

  it('delete removes a backup file after confirmation', async () => {
    await wireUser(true);
    await seedEntry();
    await localFlags.setBool(uid, 'driveGranted', true);
    await runBackup(uid, 'manual');
    const q = await render(<BackupExport />);
    await q.findByText(/YOUR BACKUPS/);
    fireEvent.press(q.getByText('Delete'));
    await q.findByText('Delete this backup?');
    fireEvent.press(q.getAllByText('Delete').at(-1)!);
    await q.findByText('No backups yet');
    expect(drive.deletes.length).toBe(1);
  });

  it('Restore row navigates to /restore', async () => {
    await wireUser(true);
    await seedEntry();
    await localFlags.setBool(uid, 'driveGranted', true);
    const q = await render(<BackupExport />);
    const row = await q.findByText('Restore');
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/restore');
  });
});
