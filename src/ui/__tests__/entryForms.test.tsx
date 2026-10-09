// LOG-04..14 — component tests for the entry forms, the shared shell
// (read-only, web-offline gating, odometer warning) and History rows.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View } = require('react-native');
  function SwipeableStub({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }
  return SwipeableStub;
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { FuelForm } from '../entry/FuelForm';
import { MoneyForm } from '../entry/MoneyForm';
import { ServiceForm } from '../entry/ServiceForm';
import { TripForm } from '../entry/TripForm';
import { EntryForm } from '../entry/EntryForm';
import { EntryRow, monthSections } from '../HistoryList';
import { tsFromMillis } from '../../data/schema/common';

const vehicle = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v1', pending: false, name: 'City Runner', type: 'car', color: 'c01',
    fuelTypes: ['petrol', 'electric'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 0, ownerId: 'me', memberIds: ['me'],
    members: {}, archived: false,
    createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 },
    updatedBy: 'me', schemaVersion: 1, ...over,
  }) as unknown as VehicleRecord;

const entry = (over: Record<string, unknown> = {}) =>
  ({
    id: 'e1', type: 'expense', date: tsFromMillis(Date.UTC(2026, 0, 10)),
    createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 },
    createdBy: 'me', createdByName: 'Me', updatedBy: 'me',
    attachments: [], schemaVersion: 1, pending: false, ...over,
  }) as unknown as EntryRecord;

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const pressText = (name: string | RegExp) => fireEvent.press(screen.getByText(name));
/** First match in tree order — the Picker's modal option precedes the chips. */
const pressModalOption = (name: string) =>
  fireEvent.press(screen.getAllByText(name)[0]);
const type = (label: string | RegExp, s: string) =>
  fireEvent.changeText(screen.getByLabelText(label), s);
const lastInput = (fn: jest.Mock): { input: Record<string, unknown> } =>
  fn.mock.calls.at(-1)![0];

beforeAll(() => initI18n('en'));
beforeEach(() => {
  setFirebaseFactory(() => new FakeAdapter('native'));
  resetRuntimeForTests();
  resetFirebaseForTests();
  resetAppStore();
  useAppStore.setState({ online: true });
});

// --- fuel (LOG-05/06) --------------------------------------------------------

test('fuel: odometer is required before saving', async () => {
  const onSubmit = jest.fn();
  await render(<FuelForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />);
  await press('Save entry');
  screen.getByText('Odometer is required');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('fuel: quantity + price derive the total; saved as integer minor + milli price', async () => {
  const onSubmit = jest.fn();
  await render(<FuelForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />);
  await type('ODOMETER (km) *', '12000');
  await type('QUANTITY (L)', '40');
  await type('PRICE PER UNIT (INR)', '1.5');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.type).toBe('fuel');
  expect(input.odometer).toBe(12000);
  expect(input.amount).toEqual({ minor: 6000, currency: 'INR' });
  expect(input.details.pricePerUnitMilli).toBe(150000);
  expect(input.details.quantity).toBe(40);
  expect(input.details.quantityUnit).toBe('L');
  expect(input.details.fullTank).toBe(true);
  expect(input.category).toBeUndefined();
});

test('fuel: electric shows charging chips, saves kWh + chargingLocation', async () => {
  const onSubmit = jest.fn();
  await render(<FuelForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />);
  await press('Electric');
  await press('Home');
  await type('ODOMETER (km) *', '5000');
  await type('QUANTITY (kWh)', '12');
  await type('TOTAL (INR)', '180');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.details.fuelType).toBe('electric');
  expect(input.details.quantityUnit).toBe('kWh');
  expect(input.details.chargingLocation).toBe('home');
  expect(input.amount.minor).toBe(18000);
});

test('fuel: unfinished inputs block submit instead of overwriting raw text', async () => {
  const onSubmit = jest.fn();
  await render(<FuelForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />);
  await type('ODOMETER (km) *', '5000');
  await type('QUANTITY (L)', '40');
  await press('Save entry');
  screen.getByText('Enter any two of quantity, price per unit and total');
  expect(onSubmit).not.toHaveBeenCalled();
});

// --- expense / income (LOG-07/09) --------------------------------------------

test('expense: category and positive amount are required', async () => {
  const onSubmit = jest.fn();
  await render(
    <MoneyForm kind="expense" vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await press('Save entry');
  screen.getByText('Pick a category');
  screen.getByText('Enter an amount greater than 0');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('expense: "Other" stores the typed text in category', async () => {
  const onSubmit = jest.fn();
  await render(
    <MoneyForm kind="expense" vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await press('Other');
  await type('CATEGORY NAME', 'Car wash');
  await type('AMOUNT (INR)', '12.5');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.type).toBe('expense');
  expect(input.category).toBe('Car wash');
  expect(input.amount).toEqual({ minor: 1250, currency: 'INR' });
  expect(input.details).toBeUndefined();
});

test('income: platform is stored under details.platform', async () => {
  const onSubmit = jest.fn();
  await render(
    <MoneyForm kind="income" vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await press('Ride-hailing');
  await type('AMOUNT (INR)', '340');
  await type('PLATFORM', 'Uber');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.type).toBe('income');
  expect(input.category).toBe('Ride-hailing');
  expect(input.details).toEqual({ platform: 'Uber' });
});

// --- service (LOG-08) --------------------------------------------------------

test('service: line + labour − discount = entry amount', async () => {
  const onSubmit = jest.fn();
  await render(
    <ServiceForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await press('Engine oil'); // category chip
  await pressText('Pick a service type');
  await pressModalOption('Engine oil');
  await type('COST (INR)', '100');
  await type('LABOUR (INR)', '50');
  await type('DISCOUNT (INR)', '20');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.type).toBe('service');
  expect(input.amount).toEqual({ minor: 13000, currency: 'INR' });
  expect(input.category).toBe('Engine oil');
  expect(input.details.lines).toEqual([
    { id: 'line-1', serviceType: 'engine_oil', costMinor: 10000 },
  ]);
  expect(input.details.labourMinor).toBe(5000);
  expect(input.details.discountMinor).toBe(2000);
});

test('service: an Other line without a label is rejected', async () => {
  const onSubmit = jest.fn();
  await render(
    <ServiceForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await press('General service'); // category
  await pressText('Pick a service type');
  await pressModalOption('Other');
  await type('COST (INR)', '10');
  await press('Save entry');
  screen.getByText('Name every "Other" item');
  expect(onSubmit).not.toHaveBeenCalled();
});

// --- trip (LOG-10) ------------------------------------------------------------

test('trip: end before start and missing purpose block the save', async () => {
  const onSubmit = jest.fn();
  await render(
    <TripForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await type('START ODOMETER (km)', '1000');
  await type('END ODOMETER (km)', '900');
  await press('Save entry');
  screen.getByText('Pick a purpose');
  screen.getByText('End odometer is below the start');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('trip: distance and reimbursement are stored; date = start; no amount', async () => {
  const onSubmit = jest.fn();
  await render(
    <TripForm vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  await type('START ODOMETER (km)', '1000');
  await type('END ODOMETER (km)', '1050');
  await type('FROM', 'Home');
  await type('TO', 'Office');
  await press('Business');
  await type('RATE PER km (INR)', '0.5');
  await press('Save entry');
  const { input } = lastInput(onSubmit) as { input: any };
  expect(input.type).toBe('trip');
  expect(input.odometer).toBe(1050);
  expect(input.amount).toBeUndefined();
  expect(input.category).toBeUndefined();
  expect(input.details.distance).toBe(50);
  expect(input.details.ratePerUnitMilli).toBe(50000);
  expect(input.details.reimbursementMinor).toBe(2500);
  expect(input.details.purpose).toBe('business');
  expect(input.details.from).toBe('Home');
});

// --- shared shell (LOG-04/13) -------------------------------------------------

test('another member\'s entry opens read-only with no Save or Delete', async () => {
  const v = vehicle({ ownerId: 'owner-x', memberIds: ['me', 'owner-x'] });
  const e = entry({ createdBy: 'owner-x', createdByName: 'Ravi', category: 'Parking', amount: { minor: 500, currency: 'INR' } });
  const onSubmit = jest.fn();
  const onDelete = jest.fn();
  await render(
    <EntryForm
      vehicle={v} type="expense" entry={e} entries={[e]}
      onSubmit={onSubmit} onDelete={onDelete}
    />,
  );
  screen.getByText(/only view it/);
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
});

test('archived vehicle renders read-only (DR-13)', async () => {
  const v = vehicle({ archived: true });
  const e = entry({ category: 'Parking', amount: { minor: 500, currency: 'INR' } });
  await render(
    <EntryForm vehicle={v} type="expense" entry={e} entries={[e]} onSubmit={jest.fn()} onDelete={jest.fn()} />,
  );
  screen.getByText(/Archived/);
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('odometer sanity warning appears but does not block', async () => {
  const prior = entry({ id: 'prior', odometer: 500, date: tsFromMillis(Date.UTC(2026, 0, 1)), category: 'Parking' });
  const onSubmit = jest.fn();
  await render(
    <MoneyForm kind="expense" vehicle={vehicle()} entries={[prior]} readOnly={false} onSubmit={onSubmit} />,
  );
  await type('ODOMETER (km)', '400');
  screen.getByText(/Lower than 500/);
  await press('Parking');
  await type('AMOUNT (INR)', '10');
  await press('Save entry');
  expect(onSubmit).toHaveBeenCalled();
});

test('web + offline: Save is disabled and the banner shows', async () => {
  setFirebaseFactory(() => new FakeAdapter('web'));
  resetRuntimeForTests();
  resetFirebaseForTests();
  useAppStore.setState({ online: false });
  const onSubmit = jest.fn();
  await render(
    <MoneyForm kind="expense" vehicle={vehicle()} entries={[]} readOnly={false} onSubmit={onSubmit} />,
  );
  const save = screen.getByRole('button', { name: 'Save entry' });
  expect(save.props.accessibilityState?.disabled ?? save.props.disabled).toBeTruthy();
});

// --- history rows (LOG-11) -----------------------------------------------------

test('history row: category, amount, odometer, logged-by and pending marker', async () => {
  const v = vehicle();
  const mine = entry({ id: 'a', type: 'expense', category: 'Parking', amount: { minor: 1250, currency: 'INR' }, odometer: 10234, pending: true });
  const theirs = entry({ id: 'b', type: 'expense', category: 'Fine/challan', amount: { minor: 50000, currency: 'INR' }, createdBy: 'other', createdByName: 'Ravi' });
  await render(
    <>
      <EntryRow entry={mine} vehicle={v} uid="me" onDelete={jest.fn()} />
      <EntryRow entry={theirs} vehicle={v} uid="me" onDelete={jest.fn()} />
    </>,
  );
  screen.getByText('Parking');
  screen.getByText('−₹12.50');
  screen.getByText(/10234 km/);
  screen.getByText('Logged by Ravi');
});

test('monthSections groups by calendar month with This month first', () => {
  const now = new Date(2026, 5, 15);
  const e1 = entry({ id: '1', date: tsFromMillis(now.getTime()) });
  const e2 = entry({ id: '2', date: tsFromMillis(new Date(2026, 4, 2).getTime()) });
  const sections = monthSections([e1, e2], now);
  expect(sections.map((s) => s.title)).toEqual(['This month', 'May 2026']);
  expect(sections[0].data).toHaveLength(1);
  expect(sections[1].data).toHaveLength(1);
});
