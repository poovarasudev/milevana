// REL-12/REL-09 — the web landing page (the signed-out SignInGate) and the
// delete-account route's sign-in prompt. Asserts the VD-11 provisional
// content: name, tagline, v1 feature list, sign-in button, policy links and
// the Play badge + screenshot placeholders.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../../features/appStore';
import { resetRuntimeForTests } from '../../features/runtime';
import { initI18n } from '../../i18n';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { SignInGate } from '../gates';

let adapter: FakeAdapter;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
  adapter = new FakeAdapter('web');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  initI18n();
});

test('signed-out visitor sees the name, tagline, features, sign-in, policy links and placeholders (SC-REL12-01)', async () => {
  const s = await render(<SignInGate />);
  s.getByText('Milevana');
  s.getByText('Free. No ads. Your data stays yours.');
  s.getByText('Continue with Google');
  // v1 feature list (VD-11)
  for (const f of [
    'Fuel and EV charging with mileage', 'Expenses, services and income',
    'Manual trips with reimbursement', 'Reminders by date and odometer',
    'Reports and cost-per-km', 'Inspection checklists',
    'Receipt photos in your Drive', 'Shared vehicles for the family',
    'Google Drive backup and CSV export', 'Works fully offline',
  ]) s.getByText(f);
  s.getByText('Privacy policy');
  s.getByText('Terms of use');
  // Play badge + screenshot placeholders
  s.getByText('Get it on Google Play');
  s.getByText('Android listing — coming soon');
  expect(s.getAllByText('App screenshots')).toHaveLength(3);
});

test('privacy and terms links open the live Hosting pages (SC-REL12-01, SC-REL11-01)', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  const s = await render(<SignInGate />);
  await fireEvent.press(s.getByText('Privacy policy'));
  expect(openURL).toHaveBeenCalledWith('https://milevana.poovarasu.dev/privacy');
  await fireEvent.press(s.getByText('Terms of use'));
  expect(openURL).toHaveBeenCalledWith('https://milevana.poovarasu.dev/terms');
});

test('a sign-in failure shows the error and a Retry button (SC-REL09-01)', async () => {
  useAppStore.setState({ signinError: true });
  const s = await render(<SignInGate />);
  s.getByText("Couldn't sign you in. Check your connection and try again.");
  s.getByText('Retry');
});
