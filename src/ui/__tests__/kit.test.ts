// backOrHome regression: `router.back()` is a no-op on deep-linked/refreshed
// web pages (no back target), which stranded users on a form after saving.

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() },
}));

import { router } from 'expo-router';
import { backOrHome } from '../kit';

const canGoBack = router.canGoBack as jest.Mock;

beforeEach(() => {
  (router.back as jest.Mock).mockClear();
  (router.replace as jest.Mock).mockClear();
  canGoBack.mockReset().mockReturnValue(true);
});

test('goes back when a back target exists', () => {
  backOrHome();
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});

test('falls back to the dashboard when there is no back target', () => {
  canGoBack.mockReturnValue(false);
  backOrHome();
  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith('/');
});
