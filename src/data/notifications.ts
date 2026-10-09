// Neutral notification entry point (REM-03), mirroring firebase.ts: Metro
// resolves notifications.native.ts on Android and notifications.web.ts on
// web; Jest maps the specifier here and tests inject a fake factory.
// Platform branching lives only in the platform files.

import type { Unsubscribe } from './adapter';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

/** Tap payloads (RD-10): where a notification tap routes. */
export interface ReminderNotificationData {
  kind: 'lead' | 'due' | 'overdue' | 'odoSoon' | 'odoNow';
  vehicleId: string;
  reminderId: string;
  /** 'open' → the vehicle's Reminders screen; 'expense' → pre-filled form. */
  action: 'open' | 'expense';
  category?: string;
  amountMinor?: number;
}

/** One scheduled local notification. `at` <= now fires as soon as possible. */
export interface ScheduledReminder {
  id: string;
  title: string;
  body: string;
  at: number;
  data: ReminderNotificationData;
}

export interface NotificationClient {
  /** Whether the OS can prompt for notification permission (Android 13+; on
   * older Android and on web there is no runtime prompt to show — RD-08). */
  readonly promptsSupported: boolean;
  getPermissionState(): Promise<NotificationPermissionState>;
  /** Show the system prompt. Resolves with the resulting state. */
  requestPermission(): Promise<NotificationPermissionState>;
  /** Atomically replace the whole scheduled set (cancel-all + schedule). */
  replaceSchedule(items: ScheduledReminder[]): Promise<void>;
  /** Remove every scheduled (and presented) notification — sign-out. */
  clearAll(): Promise<void>;
  /** Subscribe to notification taps. */
  onResponse(cb: (data: ReminderNotificationData) => void): Unsubscribe;
  /** The cold-start tap, if the app was opened by a notification; once only. */
  consumeInitialResponse(): Promise<ReminderNotificationData | null>;
  /** Open the system notification settings for this app (RD-08). */
  openSystemSettings(): void;
}

let factory: (() => NotificationClient) | null = null;
let instance: NotificationClient | null = null;

export function setNotificationsFactory(f: () => NotificationClient): void {
  factory = f;
  instance = null;
}

export function getNotifications(): NotificationClient {
  if (!instance) {
    if (!factory) throw new Error('No notification client factory installed');
    instance = factory();
  }
  return instance;
}

export function resetNotificationsForTests(): void {
  instance = null;
}
