// Web notification client (REM-03 #5): web schedules nothing — reminders are
// view/edit only there. Every call is a safe no-op.

import type {
  NotificationClient, NotificationPermissionState,
} from './notifications';
import { setNotificationsFactory } from './notifications';

const noop = (): void => undefined;

const webClient: NotificationClient = {
  promptsSupported: false,
  getPermissionState: async (): Promise<NotificationPermissionState> => 'unsupported',
  requestPermission: async (): Promise<NotificationPermissionState> => 'unsupported',
  replaceSchedule: async () => undefined,
  clearAll: async () => undefined,
  onResponse: () => noop,
  consumeInitialResponse: async () => null,
  openSystemSettings: noop,
};

setNotificationsFactory(() => webClient);

export {};
