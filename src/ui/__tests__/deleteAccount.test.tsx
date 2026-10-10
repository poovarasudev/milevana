// REL-06/08/09/11 — the shared delete-account flow (summary → Google
// re-sign-in → typed DELETE → run → done), the anonymous variant, the web
// empty state and the About & privacy links.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router } from 'expo-router';
import { AuthError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { localFlags } from '../../data/localFlags';
import type { VehicleDoc } from '../../data/schema/vehicle';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { resetRuntimeForTests, getRepos } from '../../features/runtime';
import { initI18n } from '../../i18n';
import About from '../../../app/about';
import { DeleteAccountFlow } from '../DeleteAccountFlow';
import { DeletionResumeGate } from '../gates';

const UID = 'me';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
let adapter: FakeAdapter;

function boot(linked = true, platform: 'native' | 'web' = 'native'): void {
  adapter = new FakeAdapter(platform);
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.setUser({
    uid: UID, isAnonymous: !linked,
    displayName: linked ? 'Me Name' : null, email: linked ? 'me@x.com' : null,
  });
  useAppStore.setState({ user: adapter.currentUser(), userDoc: null, online: true });
}

async function seedUser(): Promise<void> {
  await getRepos().users.ensureUser(UID, { displayName: 'Me Name', email: 'me@x.com', isLinked: true });
}

async function seedShared(): Promise<void> {
  const id = await getRepos().vehicles.create({
    name: 'Shared car', type: 'car', color: 'c03', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 1000,
  });
  const path = `vehicles/${id}`;
  const v = { ...adapter.docs.get(path) } as unknown as VehicleDoc;
  v.memberIds = [...v.memberIds, 'm1', 'm2'];
  v.members = {
    ...v.members,
    m1: { role: 'member', name: 'Mia', email: 'mia@x.com', joinedAt: ts(10) },
    m2: { role: 'member', name: 'Max', email: 'max@x.com', joinedAt: ts(20) },
  };
  adapter.docs.set(path, v as unknown as Record<string, unknown>);
}

beforeAll(() => initI18n('en'));
beforeEach(async () => {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetFirebaseForTests();
  jest.clearAllMocks();
});

test('summary lists deletes, handoffs and leaves with the longest-standing member pre-selected (SC-REL06-01)', async () => {
  boot();
  await seedUser();
  await seedShared();
  const s = await render(<DeleteAccountFlow />);

  await waitFor(() => expect(s.getByText('HANDED OVER')).toBeTruthy());
  expect(s.getByText('SHARED CAR')).toBeTruthy();
  expect(s.getByText('to Mia')).toBeTruthy(); // longest-standing member first
  expect(s.getByText('KEPT')).toBeTruthy();
  expect(s.getByText('Back up / export first')).toBeTruthy();
});

test('choosing "Delete instead" moves the shared vehicle into the deleted list (SC-REL06-02)', async () => {
  boot();
  await seedUser();
  await seedShared();
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('to Mia')).toBeTruthy());

  await fireEvent.press(s.getByText('to Mia'));
  await fireEvent.press(s.getByText('Delete instead'));
  await waitFor(() => expect(s.getByText('DELETED')).toBeTruthy());
  expect(s.getByText('· Shared car')).toBeTruthy();
});

test('"Back up / export first" opens Backup & export (SC-REL06-03)', async () => {
  boot();
  await seedUser();
  await seedShared();
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('Back up / export first')).toBeTruthy());
  await fireEvent.press(s.getByText('Back up / export first'));
  expect(router.push).toHaveBeenCalledWith('/backup-export');
});

test('deletion starts only after Google re-sign-in and DELETE in capitals (SC-REL06-04)', async () => {
  boot();
  await seedUser();
  await seedShared();
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('Continue')).toBeTruthy());
  await fireEvent.press(s.getByText('Continue'));

  await fireEvent.press(s.getByText('Sign in with Google again'));
  await waitFor(() => expect(s.getByText('Type DELETE to confirm')).toBeTruthy());

  const input = s.getByLabelText('Type DELETE to confirm');
  const confirmBtn = () => s.getByText('Delete account');

  await fireEvent.changeText(input, 'delete'); // lowercase must not confirm
  await fireEvent.press(confirmBtn());
  expect(adapter.deletedAccounts).toEqual([]);
  expect(s.queryByText('Your account and data were deleted')).toBeNull();

  await fireEvent.changeText(input, 'DELETE');
  await fireEvent.press(confirmBtn());
  await waitFor(() => expect(s.getByText('Your account and data were deleted')).toBeTruthy());
  expect(adapter.deletedAccounts).toEqual([UID]);
});

test('re-signing in with another Google account shows "Use <email>" (SC-REL06-04)', async () => {
  boot();
  await seedUser();
  await seedShared();
  adapter.reauthError = new AuthError('user-mismatch');
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('Continue')).toBeTruthy());
  await fireEvent.press(s.getByText('Continue'));
  await fireEvent.press(s.getByText('Sign in with Google again'));
  await waitFor(() => expect(s.getByText('Use me@x.com')).toBeTruthy());
});

test('anonymous users get the warning variant and no Google re-auth (SC-REL08-01)', async () => {
  boot(false);
  await getRepos().users.ensureUser(UID, { isLinked: false });
  await getRepos().vehicles.create({
    name: 'Solo', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  });
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('Delete all my data')).toBeTruthy());
  expect(s.queryByText('Sign in with Google again')).toBeNull();

  await fireEvent.press(s.getByText('Delete all my data'));
  await waitFor(() => expect(s.getByText('Your account and data were deleted')).toBeTruthy());
  expect(adapter.deletedAccounts).toEqual([UID]);
});

test('anonymous on the web route gets only the "delete from the app" instruction (SC-REL08-03)', async () => {
  boot(false, 'web');
  await getRepos().users.ensureUser(UID, { isLinked: false });
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() =>
    expect(s.getByText('If you never linked Google, delete your data from the app on your phone.')).toBeTruthy());
  expect(s.queryByText('Delete all my data')).toBeNull();
  expect(adapter.deletedAccounts).toEqual([]);
});

test('a signed-in visitor with no data sees the empty state (SC-REL09-03)', async () => {
  boot(true, 'web');
  const s = await render(<DeleteAccountFlow />);
  await waitFor(() => expect(s.getByText('No Milevana data found for this account')).toBeTruthy());
});

test('an unfinished deletion resumes through the gate, re-signing in first (SC-REL07-01/02, SC-REL09-03)', async () => {
  boot(true, 'web');
  await seedUser();
  // A run recorded on another device: all data steps done; only the account
  // step remains — exactly what a cross-device resume sees.
  await getRepos().users.setDeletion(UID, {
    status: 'in-progress', startedAt: ts(1), handoffs: {},
    completedSteps: ['handoffs', 'vehicles', 'memberships', 'invites', 'user'],
  });
  useAppStore.setState({ phase: 'deleting' });
  const s = await render(<DeletionResumeGate />);
  await waitFor(() => expect(s.getByText('Finish deleting your account')).toBeTruthy());
  // VD-07: once confirmed there is no Cancel — the body text mentions
  // "cannot be cancelled", so match the exact button label only.
  expect(s.queryByText('Cancel')).toBeNull();

  await fireEvent.press(s.getByText('Continue'));
  await waitFor(() => expect(adapter.deletedAccounts).toEqual([UID]));
  expect(await localFlags.deletion(UID)).toBeNull();
});

describe('About & privacy (REL-11)', () => {
  test('shows version and links to the policy, terms and delete-account pages (SC-REL11-01)', async () => {
    boot();
    const s = await render(<About />);
    await waitFor(() => expect(s.getByText('About & privacy')).toBeTruthy());
    expect(s.getByText('Privacy policy')).toBeTruthy();
    expect(s.getByText('Terms of use')).toBeTruthy();
    expect(s.getByText('Delete account')).toBeTruthy();

    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await fireEvent.press(s.getByText('Privacy policy'));
    expect(openURL).toHaveBeenCalledWith('https://milevana.poovarasu.dev/privacy');
    await fireEvent.press(s.getByText('Terms of use'));
    expect(openURL).toHaveBeenCalledWith('https://milevana.poovarasu.dev/terms');
  });

  test('offline shows a clear message instead of opening the browser (SC-REL11-01)', async () => {
    boot();
    useAppStore.setState({ online: false });
    const s = await render(<About />);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await fireEvent.press(await waitFor(() => s.getByText('Privacy policy')));
    expect(openURL).not.toHaveBeenCalled();
    expect(s.getByText(/offline/i)).toBeTruthy();
  });
});
