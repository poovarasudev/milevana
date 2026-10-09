// FND-SHL-03 / FND-OBS-01 — per-screen error boundary: friendly fallback,
// privacy-safe non-fatal report, Retry resets the tree.

import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { setFirebaseFactory, resetFirebaseForTests } from '../../data/firebase';
import { FakeAdapter } from '../../features/__tests__/fakeAdapter';
import { resetRuntimeForTests } from '../../features/runtime';
import { initI18n } from '../../i18n';
import { ErrorBoundary } from '../ErrorBoundary';

let adapter: FakeAdapter;
let bomb = true;

function MaybeBombed() {
  if (bomb) throw new Error('render exploded with user-name: Jane Doe');
  return <Text>recovered</Text>;
}

beforeAll(() => initI18n('en'));
beforeEach(() => {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetFirebaseForTests();
  bomb = true;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => (console.error as jest.Mock).mockRestore());

test('a crashing child shows the fallback, reports a sanitized non-fatal, and Retry recovers', async () => {
  await render(
    <ErrorBoundary screen="settings">
      <MaybeBombed />
    </ErrorBoundary>,
  );
  screen.getByText('Something went wrong');
  expect(adapter.reports).toHaveLength(1);
  // No message text or user content is reported — only the error name.
  expect((adapter.reports[0].error as Error).message).toBe('Error:Error');
  expect(adapter.reports[0].context!.screen).toBe('settings');

  bomb = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
  screen.getByText('recovered');
  expect(screen.queryByText('Something went wrong')).toBeNull();
});
