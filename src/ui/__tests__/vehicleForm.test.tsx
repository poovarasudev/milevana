// FND-VEH-01/02 — VehicleForm validation, locked-unit behaviour and defaults
// from settings (component level).

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { resetRuntimeForTests } from '../../features/runtime';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { initI18n } from '../../i18n';
import { defaultValues, VehicleForm, VehicleFormValues } from '../VehicleForm';

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

beforeAll(() => initI18n('en'));
beforeEach(() => {
  setFirebaseFactory(() => new FakeAdapter('native'));
  resetRuntimeForTests();
  resetFirebaseForTests();
  resetAppStore();
});

async function setup(initial?: Partial<VehicleFormValues>, locked = false) {
  const onSubmit = jest.fn();
  await render(
    <VehicleForm
      initial={{ ...defaultValues(), ...initial }}
      locked={locked}
      saving={false}
      onSubmit={onSubmit}
      submitLabel="Save vehicle"
    />,
  );
  return { onSubmit };
}

test('defaults come from user settings (currency, odometer unit)', async () => {
  useAppStore.setState({
    userDoc: { settings: { currency: 'USD', distanceUnit: 'mi' } } as never,
  });
  await setup();
  expect(defaultValues().currency).toBe('USD');
  expect(defaultValues().odometerUnit).toBe('mi');
  screen.getByText('USD');
  screen.getByRole('button', { name: 'mi' });
});

test('empty name blocks submit with an inline error', async () => {
  const { onSubmit } = await setup();
  await press('Save vehicle');
  screen.getByText('Name is required');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('an odometer with two decimals is rejected', async () => {
  const { onSubmit } = await setup({ name: 'Swift' });
  await fireEvent.changeText(screen.getByPlaceholderText('0'), '12.34');
  await press('Save vehicle');
  screen.getByText('Enter a number, one decimal at most');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('removing every fuel type blocks submit', async () => {
  const { onSubmit } = await setup({ name: 'Swift' });
  await press('Petrol');
  await press('Save vehicle');
  screen.getByText('Pick at least one fuel type');
  expect(onSubmit).not.toHaveBeenCalled();
});

test('a valid form submits the entered values', async () => {
  const { onSubmit } = await setup();
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Swift Dzire'), 'My Bike');
  // The type tile's accessible name includes its icon glyph — press the text.
  await fireEvent.press(screen.getByText('Bike'));
  await press('Save vehicle');
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit.mock.calls[0][0]).toMatchObject({
    name: 'My Bike', type: 'bike', odometerUnit: 'km', currency: 'INR',
  });
});

test('locked mode disables unit/currency/start-odometer edits (DR-01)', async () => {
  const { onSubmit } = await setup({ name: 'Swift' }, true);
  screen.getByText('Unit and currency are locked once the vehicle has entries.');
  screen.getByText('The start odometer is set at creation.');
  await press('mi'); // disabled chip — no effect
  await press('Save vehicle');
  expect(onSubmit.mock.calls[0][0].odometerUnit).toBe('km');
});
