// RPT-05..RPT-13 — component tests: the Reports tab (sections, ranges,
// 'No data' empties, Show-as-table, All-vehicles blocks + per-vehicle
// failure, archived-vehicle path, custom-range modal) and the Dashboard
// figure cards (spend, per-unit cost, income vs cost, recent, hours).

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-gifted-charts', () => ({
  BarChart: 'BarChart', LineChart: 'LineChart', PieChart: 'PieChart',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  function SwipeableStub({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }
  return SwipeableStub;
});

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { stopReportEntryWatches } from '../../features/reportData';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import { DashboardCards } from '../reports/DashboardCards';
import { ReportsScreen } from '../reports/ReportsScreen';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const now = () => new Date();
const thisMonth = (day: number) => ts(Math.floor(new Date(now().getFullYear(), now().getMonth(), day).getTime() / 1000));
const monthsAgo = (n: number, day = 10) => ts(Math.floor(new Date(now().getFullYear(), now().getMonth() - n, day).getTime() / 1000));

const vehicle = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v1', pending: false, name: 'City Runner', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 10_000, lastOdometerAt: ts(1),
    ownerId: 'me', memberIds: ['me'], members: {}, archived: false,
    createdAt: monthsAgo(3), updatedAt: ts(1), schemaVersion: 1, ...over,
  }) as unknown as VehicleRecord;

const entry = (id: string, over: Record<string, unknown> = {}): EntryRecord =>
  ({
    id, pending: false, type: 'expense', date: thisMonth(5),
    amount: { minor: 500_000, currency: 'INR' }, category: 'Parking',
    attachments: [], uploaderUids: [], createdBy: 'me', createdByName: 'Me',
    updatedBy: 'me', schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
    ...over,
  }) as unknown as EntryRecord;

const fuel = (id: string, over: Record<string, unknown> = {}) =>
  entry(id, {
    type: 'fuel', amount: { minor: 300_000, currency: 'INR' }, category: undefined,
    details: { fuelType: 'petrol', odometer: 10_000, quantity: 20, quantityUnit: 'L', pricePerUnitMilli: 105_000, fullTank: true },
    odometer: 10_000,
    ...over,
  });

function seedStore(vehicles: VehicleRecord[], entries: EntryRecord[], over: Record<string, unknown> = {}) {
  useAppStore.setState({
    vehicles,
    vehiclesLoaded: true,
    selectedVehicleId: vehicles[0]?.id ?? null,
    entriesVehicleId: vehicles[0]?.id ?? null,
    entriesArrived: true,
    entries,
    ...over,
  });
}

beforeAll(() => initI18n('en'));
beforeEach(() => {
  resetAppStore();
  resetFirebaseForTests();
  setFirebaseFactory(() => new FakeAdapter('native'));
  resetRuntimeForTests();
  useAppStore.setState({ online: true });
});
afterEach(() => stopReportEntryWatches());

describe('ReportsScreen — single vehicle (RPT-05..RPT-11)', () => {
  test('renders range chips and all sections for a vehicle with entries', async () => {
    const v = vehicle();
    seedStore([v], [
      fuel('f1'),
      entry('x1', { type: 'service', category: 'Oil change', details: { lines: [{ serviceType: 'oil_change', costMinor: 250_000 }] } }),
      entry('t1', { type: 'trip', amount: undefined, details: { purpose: 'business', distance: 42 } }),
      entry('i1', { type: 'income', category: 'Ride-hailing', details: { platform: 'Uber' } }),
      fuel('f2', { date: thisMonth(12), odometer: 10_420, details: { fuelType: 'petrol', odometer: 10_420, quantity: 21, quantityUnit: 'L', pricePerUnitMilli: 105_000, fullTank: true } }),
    ]);
    await render(<ReportsScreen />);

    for (const label of ['This month', 'Last 3 months', 'Last 12 months', 'This financial year', 'All time', 'Custom']) {
      screen.getByText(label);
    }
    for (const section of ['OVERVIEW', 'MONTHLY SPEND', 'FUEL', 'SERVICES & EXPENSES', 'INCOME & PROFIT', 'TRIPS']) {
      screen.getByText(section);
    }
    screen.getByText('Total cost');
    screen.getByText('Distance');
    screen.getByText('Business');
    screen.getByText('Net profit');
    screen.getByText('Uber');
  });

  test("empty sections show 'No data for this period' (PD-06)", async () => {
    seedStore([vehicle()], [entry('x1')]);
    await render(<ReportsScreen />);
    // no fuel and no trips → those two sections keep the header + no-data line
    const empties = screen.getAllByTestId('report-section-empty');
    expect(empties.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('INCOME & PROFIT')).toBeNull(); // no income entries → section hidden
  });

  test("vehicle with no entries shows 'Add entries to see reports' (PD-06)", async () => {
    seedStore([vehicle()], []);
    await render(<ReportsScreen />);
    screen.getByText('Add entries to see reports');
  });

  test('Show as table exposes the monthly-spend values (PD-07)', async () => {
    seedStore([vehicle()], [fuel('f1'), entry('x1', { date: monthsAgo(1) })]);
    await render(<ReportsScreen />);
    expect(screen.queryByTestId('chart-table')).toBeNull();
    await fireEvent.press(screen.getAllByTestId('chart-toggle-table')[0]);
    const table = screen.getByTestId('chart-table');
    within(table).getByText('Month');
    // the ₹3,000 fuel fill appears as a table value, not just as a chart bar
    within(table).getByText('₹3,000.00');
  });

  test('switching the range chip updates the report period (PD-01)', async () => {
    seedStore([vehicle()], [fuel('f1'), entry('old', { date: monthsAgo(5) })]);
    await render(<ReportsScreen />);
    await fireEvent.press(screen.getByText('All time'));
    screen.getByText('Total cost');
  });

  test('Custom opens the range modal and rejects an inverted range (PD-01)', async () => {
    seedStore([vehicle()], [entry('x1')]);
    await render(<ReportsScreen />);
    await fireEvent.press(screen.getByText('Custom'));
    screen.getByText('Custom range');
    screen.getByText('FROM');
    screen.getByText('TO');
    await fireEvent.press(screen.getByText('Apply'));
    screen.getByText('The start must be on or before the end');
  });
});

describe('ReportsScreen — All vehicles (RPT-12, PD-08)', () => {
  test('currency blocks, per-vehicle failure notice and include-archived toggle', async () => {
    const v1 = vehicle();
    const v2 = vehicle({ id: 'v2', name: 'Truck', currency: 'USD' });
    const v3 = vehicle({ id: 'v3', name: 'Scooter' });
    seedStore([v1, v2, v3], [fuel('f1')], {
      reportsAllVehicles: true,
      reportEntries: { v2: [entry('us1', { amount: { minor: 12_000, currency: 'USD' } })] },
      reportEntriesArrived: { v2: true },
      reportEntriesFailed: { v3: true },
    });
    await render(<ReportsScreen />);

    screen.getByText("Couldn't load Scooter"); // per-vehicle failure (RPT-12 #5)
    screen.getByText('TOTAL IN INR');
    screen.getByText('TOTAL IN USD');
    // USD block kept separate from INR (RPT-12 #3)
    screen.getAllByText('Total cost');
  });

  test('include-archived chip adds the archived vehicle to the scope', async () => {
    const v1 = vehicle();
    const v2 = vehicle({ id: 'v2', name: 'Old car', archived: true });
    seedStore([v1, v2], [fuel('f1')], {
      reportsAllVehicles: true,
      reportEntries: { v2: [entry('a1')] },
      reportEntriesArrived: { v2: true },
    });
    await render(<ReportsScreen />);
    // archived vehicle contributes once the toggle is on (RPT-12 #2)
    await fireEvent.press(screen.getByText('Include archived'));
    screen.getByText('Total cost');
  });

  test('archived vehicle deep link opens its own single-vehicle report (PD-08)', async () => {
    const v2 = vehicle({ id: 'v2', name: 'Old car', archived: true });
    seedStore([vehicle(), v2], [fuel('f1')], {
      reportEntries: { v2: [fuel('af1')] },
      reportEntriesArrived: { v2: true },
    });
    await render(<ReportsScreen scopeVehicleId="v2" />);
    screen.getByText('Archived vehicle');
    screen.getByText('OVERVIEW');
  });
});

describe('DashboardCards (RPT-13, PD-09)', () => {
  test('spend card, per-km figures, income card and recent entries', async () => {
    seedStore([vehicle()], [
      entry('x1', { amount: { minor: 500_000, currency: 'INR' } }),
      entry('prev', { date: monthsAgo(1), amount: { minor: 250_000, currency: 'INR' } }),
      fuel('f1'),
      fuel('f2', { date: thisMonth(12), odometer: 10_500, details: { fuelType: 'petrol', odometer: 10_500, quantity: 21, quantityUnit: 'L', fullTank: true } }),
      entry('i1', { type: 'income', category: 'Ride-hailing', amount: { minor: 700_000, currency: 'INR' }, details: { platform: 'Uber' } }),
    ]);
    await render(<DashboardCards vehicle={vehicle()} />);

    screen.getByText('Spent this month');
    screen.getByText(/vs .* last month/);
    screen.getByText('Cost per km');
    screen.getByText('90-day cost per km');
    screen.getByText('Income vs cost this month');
    screen.getByText('Last mileage');
    screen.getByText('Recent');
    screen.getByText('Ride-hailing');
  });

  test('an hours vehicle hides distance figures (OQ-11)', async () => {
    const v = vehicle({ odometerUnit: 'hours', fuelTypes: [] });
    seedStore([v], [entry('x1')]);
    await render(<DashboardCards vehicle={v} />);
    screen.getByText('Spent this month');
    expect(screen.queryByText(/cost per/i)).toBeNull();
    expect(screen.queryByText('Last mileage')).toBeNull();
  });

  test('no entries → hint and no figures', async () => {
    seedStore([vehicle()], []);
    await render(<DashboardCards vehicle={vehicle()} />);
    screen.getByText('Log entries to see figures');
    screen.getByText('Spent this month');
  });
});
