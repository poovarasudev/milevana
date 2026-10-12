// Regression for the deep-link crash found in web verification: a store
// selector that fell back to a fresh `[]` on every call looped
// `useSyncExternalStore` forever ("getSnapshot should be cached" →
// "Maximum update depth exceeded") when the screen was cold-mounted before
// the entries watch attached. Rendering the screen in that state must not
// hang or throw.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => false, replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ type: 'expense' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

import { render, screen } from '@testing-library/react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../src/data/firebase';
import type { VehicleRecord } from '../../src/data/repos/vehicleRepo';
import { resetAppStore, useAppStore } from '../../src/features/appStore';
import { resetRuntimeForTests } from '../../src/features/runtime';
import { FakeAdapter } from '../../src/features/__tests__/fakeAdapter';
import { initI18n } from '../../src/i18n';
import EntryScreen from '../entry/[type]';

const vehicle = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v1', pending: false, name: 'City Runner', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 0, ownerId: 'me', memberIds: ['me'],
    members: {}, archived: false,
    createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 },
    updatedBy: 'me', schemaVersion: 1, ...over,
  }) as unknown as VehicleRecord;

beforeAll(() => initI18n('en'));

beforeEach(() => {
  resetAppStore();
  resetFirebaseForTests();
  resetRuntimeForTests();
  setFirebaseFactory(() => new FakeAdapter());
});

test('entry form renders when the entries watch has not attached yet (deep link)', async () => {
  useAppStore.setState({
    phase: 'ready',
    vehicles: [vehicle()],
    selectedVehicleId: 'v1',
    // The watch is still pointing at a previous vehicle — the selector's
    // fallback branch is taken on every render.
    entriesVehicleId: 'other-vehicle',
    entries: [],
    entriesArrived: false,
  });
  await render(<EntryScreen />);
  expect(screen.getByText('Save entry')).toBeTruthy();
});
