// REM-04/05/07/09/10/11 — component tests: the reminders list (order, due
// text, snooze + quick-add), the form (prefill, triggers, validation, hours
// vehicles, web-offline) and the Dashboard "Upcoming & overdue" card.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../data/firebase';
import { setNotificationsFactory, resetNotificationsForTests } from '../../data/notifications';
import type { NotificationClient } from '../../data/notifications';
import type { ReminderRecord } from '../../data/repos/reminderRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { isReminderSnoozed } from '../../features/reminders';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import { MoneyForm } from '../entry/MoneyForm';
import { ReminderForm, ReminderFormResult } from '../ReminderForm';
import { RemindersList, ReminderPreset } from '../RemindersList';
import { UpcomingCard } from '../UpcomingCard';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const nowS = () => Math.floor(Date.now() / 1000);
const inDays = (d: number) => ts(nowS() + d * 86400);

const vehicle = (over: Record<string, unknown> = {}) =>
  ({
    id: 'v1', pending: false, name: 'City Runner', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 10_000, lastOdometerAt: ts(1),
    ownerId: 'me', memberIds: ['me'], members: {}, archived: false,
    createdAt: ts(1), updatedAt: ts(1), schemaVersion: 1, ...over,
  }) as unknown as VehicleRecord;

const reminder = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id, pending: false, title: `Reminder ${id}`,
    subject: { kind: 'expense', category: 'Insurance' },
    dateTrigger: { dueDate: inDays(10) },
    leadDays: 7, leadDistance: 500, status: 'active',
    createdBy: 'me', createdAt: ts(1), updatedAt: ts(1), schemaVersion: 1,
    ...over,
  }) as unknown as ReminderRecord;

const noNotifs: NotificationClient = {
  promptsSupported: false,
  getPermissionState: async () => 'unsupported',
  requestPermission: async () => 'unsupported',
  replaceSchedule: async () => undefined,
  clearAll: async () => undefined,
  onResponse: () => () => undefined,
  consumeInitialResponse: async () => null,
  openSystemSettings: () => undefined,
};

/** Put v1 + its reminders in the read model. */
function seedStore(rs: ReminderRecord[], vehicleOver: Record<string, unknown> = {}) {
  useAppStore.setState({
    vehicles: [vehicle(vehicleOver)],
    reminders: { v1: rs },
    remindersArrived: { v1: true },
    selectedVehicleId: 'v1',
    entriesVehicleId: 'v1',
  });
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const pressText = (name: string | RegExp) => fireEvent.press(screen.getByText(name));
const type = (label: string | RegExp, s: string) =>
  fireEvent.changeText(screen.getByLabelText(label), s);
const lastCall = (fn: jest.Mock): ReminderFormResult => fn.mock.calls.at(-1)![0];

beforeAll(() => initI18n('en'));
beforeEach(() => {
  jest.useRealTimers();
  resetAppStore();
  resetFirebaseForTests();
  resetNotificationsForTests();
  setFirebaseFactory(() => new FakeAdapter('native'));
  setNotificationsFactory(() => noNotifs);
  resetRuntimeForTests();
  useAppStore.setState({ online: true });
});

// --- REM-04: list ---------------------------------------------------------------

describe('RemindersList (REM-04)', () => {
  test('rows show title, due text, status and the repeat icon in urgency order', async () => {
    seedStore([
      reminder('up', { title: 'Upcoming one', dateTrigger: { dueDate: inDays(20) } }),
      reminder('od', { title: 'Overdue one', dateTrigger: { dueDate: inDays(-3) } }),
      reminder('odo', {
        title: 'Odo one', dateTrigger: undefined,
        odometerTrigger: { dueOdometer: 11_200, repeatEveryDistance: 10_000 },
      }),
    ]);
    await render(
      <RemindersList vehicle={vehicle()} onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()} />,
    );
    screen.getByText('Overdue one');
    screen.getByText('Upcoming one');
    screen.getByText('Odo one');
    screen.getByText('Overdue by 3 days');
    screen.getByText('Due in 1,200 km'); // no prediction — plain remaining distance
    const order = JSON.stringify(screen.toJSON());
    expect(order.indexOf('Overdue one')).toBeLessThan(order.indexOf('Upcoming one'));
    expect(order.indexOf('Upcoming one')).toBeLessThan(order.indexOf('Odo one'));
  });

  test('empty state + the three quick-add templates call onAdd', async () => {
    seedStore([]);
    const onAdd = jest.fn();
    await render(
      <RemindersList vehicle={vehicle()} onAdd={onAdd} onEdit={jest.fn()} onLogExpense={jest.fn()} />,
    );
    screen.getByText('No reminders yet');
    await pressText('Add reminder'); // icon glyph joins the accessible name
    expect(onAdd).toHaveBeenLastCalledWith();
    for (const [label, preset] of [
      ['Insurance renewal', 'insurance'],
      ['PUC expiry', 'puc'],
      ['Service every 10,000 km / 12 months', 'service'],
    ] as [string, ReminderPreset][]) {
      await press(label);
      expect(onAdd).toHaveBeenLastCalledWith(preset);
    }
  });

  test('an hours vehicle gets no service-every-distance template', async () => {
    seedStore([]);
    await render(
      <RemindersList
        vehicle={vehicle({ odometerUnit: 'hours' })}
        onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()}
      />,
    );
    expect(screen.queryByText('Service every 10,000 km / 12 months')).toBeNull();
    screen.getByText('Insurance renewal');
  });

  test('a malformed reminder shows the skipped-docs notice', async () => {
    seedStore([]);
    useAppStore.setState({
      skippedDocs: [{
        kind: 'reminders', id: 'bad', path: 'vehicles/v1/reminders/bad',
        code: 'invalid', paths: ['title'],
      }],
    });
    await render(
      <RemindersList vehicle={vehicle()} onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()} />,
    );
    screen.getByText('1 reminder couldn’t be shown');
  });

  test('an archived vehicle is read-only: banner, no actions, no templates', async () => {
    seedStore([reminder('r1')], { archived: true });
    await render(
      <RemindersList
        vehicle={vehicle({ archived: true })}
        onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()}
      />,
    );
    screen.getByText(/archived — reminders here are read-only/);
    expect(screen.queryByText('Mark done')).toBeNull();
    expect(screen.queryByText('Snooze')).toBeNull();
    expect(screen.queryByText('Insurance renewal')).toBeNull();
  });
});

// --- REM-07: snooze + mark done actions -----------------------------------------

describe('list actions (REM-07)', () => {
  test('snooze chips: tomorrow / 3 days / next week; picking one snoozes the row', async () => {
    seedStore([reminder('r1', { title: 'Oil' })]);
    await render(
      <RemindersList vehicle={vehicle()} onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()} />,
    );
    await press('Snooze');
    screen.getByText('Snooze until 9 AM…');
    await press('Tomorrow');
    expect(isReminderSnoozed('r1')).toBe(true);
  });

  test('a snoozed row shows "Snoozed until" + Cancel snooze instead of actions', async () => {
    seedStore([reminder('r1', { title: 'Oil' })]);
    useAppStore.setState({ snoozes: { r1: Date.now() + 86_400_000 } });
    await render(
      <RemindersList vehicle={vehicle()} onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={jest.fn()} />,
    );
    screen.getByText(/Snoozed until/);
    screen.getByText('Cancel snooze');
    expect(screen.queryByText('Mark done')).toBeNull();
  });

  test('an amount reminder offers Log expense (REM-11)', async () => {
    const onLogExpense = jest.fn();
    seedStore([reminder('r1', { title: 'EMI', amountMinor: 1_250_000 })]);
    await render(
      <RemindersList vehicle={vehicle()} onAdd={jest.fn()} onEdit={jest.fn()} onLogExpense={onLogExpense} />,
    );
    await press('Log expense');
    expect(onLogExpense).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });
});

// --- REM-10: dashboard card ------------------------------------------------------

describe('UpcomingCard (REM-10)', () => {
  const renderCard = async (over: Record<string, unknown> = {}) => {
    const onOpenReminder = jest.fn(); const onSeeAll = jest.fn(); const onAdd = jest.fn();
    await render(
      <UpcomingCard
        vehicle={vehicle(over)}
        onOpenReminder={onOpenReminder} onSeeAll={onSeeAll} onAdd={onAdd}
      />,
    );
    return { onOpenReminder, onSeeAll, onAdd };
  };

  test('at most 3 rows: overdue first, then soonest due, unpredicted odometer after dated', async () => {
    seedStore([
      reminder('d20', { title: 'Dated far', dateTrigger: { dueDate: inDays(20) } }),
      reminder('od', { title: 'Old one', dateTrigger: { dueDate: inDays(-2) } }),
      reminder('d5', { title: 'Dated soon', dateTrigger: { dueDate: inDays(5) } }),
      reminder('odo', {
        title: 'Odo no-pred', dateTrigger: undefined,
        odometerTrigger: { dueOdometer: 20_000 },
      }),
    ]);
    await renderCard();
    const order = JSON.stringify(screen.toJSON());
    for (const title of ['Old one', 'Dated soon', 'Dated far']) screen.getByText(title);
    expect(screen.queryByText('Odo no-pred')).toBeNull(); // 4th row capped
    expect(order.indexOf('Old one')).toBeLessThan(order.indexOf('Dated soon'));
    expect(order.indexOf('Dated soon')).toBeLessThan(order.indexOf('Dated far'));
  });

  test('snoozed reminders are hidden; a muted vehicle still shows', async () => {
    seedStore([
      reminder('r1', { title: 'Snoozed one', dateTrigger: { dueDate: inDays(-1) } }),
      reminder('r2', { title: 'Visible one', dateTrigger: { dueDate: inDays(4) } }),
    ]);
    useAppStore.setState({
      snoozes: { r1: Date.now() + 86_400_000 },
      userDoc: {
        settings: { mutedReminderVehicleIds: ['v1'], dateFormat: 'DD/MM/YYYY' },
      } as never, // muted = notifications only; the card must still list it
    });
    await renderCard();
    expect(screen.queryByText('Snoozed one')).toBeNull();
    screen.getByText('Visible one');
  });

  test('empty state offers the add shortcut and hides See all', async () => {
    seedStore([]);
    const { onAdd } = await renderCard();
    screen.getByText('No upcoming reminders');
    await pressText('Add reminder');
    expect(onAdd).toHaveBeenCalled();
    expect(screen.queryByText('See all')).toBeNull();
  });

  test('See all + row taps route out', async () => {
    seedStore([reminder('r1', { title: 'PUC', dateTrigger: { dueDate: inDays(6) } })]);
    const { onSeeAll, onOpenReminder } = await renderCard();
    await press('See all');
    expect(onSeeAll).toHaveBeenCalled();
    await pressText('PUC');
    expect(onOpenReminder).toHaveBeenCalledWith('r1');
  });
});

// --- REM-05: form -----------------------------------------------------------------

describe('ReminderForm (REM-05)', () => {
  const renderForm = async (props: Partial<Parameters<typeof ReminderForm>[0]> = {}) => {
    const onSubmit = jest.fn();
    await render(
      <ReminderForm vehicle={vehicle()} onSubmit={onSubmit} {...props} />,
    );
    return { onSubmit };
  };

  test('saving with neither trigger is blocked', async () => {
    const { onSubmit } = await renderForm();
    await type('TITLE', 'Wash');
    await press('Save reminder');
    screen.getByText('Set a date, an odometer, or both.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('picking a service type pre-fills the title until it is edited', async () => {
    await renderForm();
    await press('A service');
    await pressText('—'); // open the service-type picker (chevron glyph joins the name)
    await pressText('Engine oil');
    expect(screen.getByLabelText('TITLE')).toHaveProp('value', 'Engine oil');
  });

  test('the insurance template pre-fills subject + title; saving needs a date', async () => {
    const { onSubmit } = await renderForm({ preset: 'insurance' });
    expect(screen.getByLabelText('TITLE')).toHaveProp('value', 'Insurance renewal');
    await press('Save reminder');
    screen.getByText('Pick a due date'); // date trigger on, no date picked
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('the service template saves both triggers with repeats', async () => {
    const { onSubmit } = await renderForm({ preset: 'service' });
    await press('Save reminder');
    const res = lastCall(onSubmit);
    expect(res).toMatchObject({
      input: {
        subject: { kind: 'service', serviceType: 'general_service' },
        dateTrigger: { repeatEveryMonths: 12 },
        odometerTrigger: { dueOdometer: 20_000, repeatEveryDistance: 10_000 },
        leadDays: 7, leadDistance: 500, status: 'active',
      },
    });
  });

  test('an hours vehicle offers no odometer trigger', async () => {
    await renderForm({ vehicle: vehicle({ odometerUnit: 'hours' }) });
    expect(screen.queryByText('By odometer')).toBeNull();
    const { onSubmit } = await renderForm({ vehicle: vehicle({ odometerUnit: 'hours' }), preset: 'service' });
    await press('Save reminder');
    const res = lastCall(onSubmit) as { input: Record<string, unknown> };
    expect(res.input.odometerTrigger).toBeUndefined();
  });

  test('range validation: repeat 121 months / 366 lead days are rejected', async () => {
    const { onSubmit } = await renderForm({ preset: 'insurance' });
    await type('REPEAT EVERY — MONTHS', '121');
    await type('REMIND ME — DAYS BEFORE', '366');
    await press('Save reminder');
    screen.getByText('Between 1 and 120 months');
    screen.getByText('Between 0 and 365 days');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('a 61-character title is rejected', async () => {
    const { onSubmit } = await renderForm({ preset: 'insurance' });
    await type('TITLE', 'x'.repeat(61));
    await press('Save reminder');
    screen.getByText('Keep it to 60 characters');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('edit mode emits a patch; clearing the date trigger writes null', async () => {
    const { onSubmit } = await renderForm({ reminder: reminder('r9', { title: 'Old title' }) });
    await type('TITLE', 'New title');
    // At least one trigger is required: switch on odometer, then switch date off.
    await fireEvent(screen.getAllByRole('switch')[1], 'onValueChange', true); // By odometer
    await type('DUE ODOMETER (km)', '20000');
    await fireEvent(screen.getAllByRole('switch')[0], 'onValueChange', false); // By date
    await press('Save reminder');
    const res = lastCall(onSubmit) as { patch: Record<string, unknown> };
    expect(res.patch).toMatchObject({ title: 'New title' });
    expect(res.patch.dateTrigger).toBeNull();
    expect(res.patch.odometerTrigger).toEqual({ dueOdometer: 20_000 });
  });

  test('web-offline disables the save button', async () => {
    resetRuntimeForTests();
    resetFirebaseForTests();
    setFirebaseFactory(() => new FakeAdapter('web'));
    useAppStore.setState({ online: false });
    const { onSubmit } = await renderForm({ preset: 'insurance' });
    screen.getByText("You're offline — changes can't be saved.");
    const save = screen.getByRole('button', { name: 'Save reminder' });
    expect(save.props.accessibilityState?.disabled ?? save.props.disabled).toBeTruthy();
    await press('Save reminder');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// --- REM-11: pre-filled expense ----------------------------------------------------

describe('EMI prefill (REM-11)', () => {
  test('the expense form saves the pre-filled Loan EMI amount as one entry', async () => {
    const onSubmit = jest.fn();
    await render(
      <MoneyForm
        kind="expense" vehicle={vehicle()} entries={[]} readOnly={false}
        prefill={{ category: 'Loan EMI', amountMinor: 1_250_000 }}
        onSubmit={onSubmit}
      />,
    );
    await press('Save entry');
    const { input } = onSubmit.mock.calls.at(-1)![0] as { input: Record<string, unknown> };
    expect(input.type).toBe('expense');
    expect(input.category).toBe('Loan EMI');
    expect(input.amount).toEqual({ minor: 1_250_000, currency: 'INR' });
  });
});
