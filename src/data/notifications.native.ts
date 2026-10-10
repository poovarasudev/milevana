// Native notification client (REM-03): local, inexact notifications through
// expo-notifications on Android. The whole scheduled set is rebuilt by
// cancel-all + recreate; sign-out calls clearAll (FR-OUT-05). No exact-alarm
// permission is requested — Date triggers are inexact by design.

import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type {
  NotificationClient, NotificationPermissionState, ReminderNotificationData,
  ScheduledReminder,
} from './notificationsCore';
import { setNotificationsFactory } from './notificationsCore';

const CHANNEL_ID = 'reminders';

let ready = false;
let sawInitial = false;

async function ensureSetup(): Promise<void> {
  if (ready) return;
  ready = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders', // i18n-allow — system-level channel label
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function mapStatus(s: Notifications.NotificationPermissionsStatus): NotificationPermissionState {
  if (s.granted || s.status === 'granted') return 'granted';
  if (s.status === 'denied') return 'denied';
  return 'undetermined';
}

function toData(raw: unknown): ReminderNotificationData | null {
  const d = raw as Partial<ReminderNotificationData> | undefined;
  if (!d || typeof d.vehicleId !== 'string' || typeof d.reminderId !== 'string') return null;
  return {
    kind: (d.kind as ReminderNotificationData['kind']) ?? 'due',
    vehicleId: d.vehicleId,
    reminderId: d.reminderId,
    action: d.action === 'expense' ? 'expense' : 'open',
    category: typeof d.category === 'string' ? d.category : undefined,
    amountMinor: typeof d.amountMinor === 'number' ? d.amountMinor : undefined,
  };
}

const nativeClient: NotificationClient = {
  // The runtime permission exists on Android 13+ (API 33). Older Android has
  // no prompt and gets no in-app notice (RD-08); iOS prompts normally.
  promptsSupported: Platform.OS !== 'android' || Platform.Version >= 33,

  async getPermissionState() {
    try {
      return mapStatus(await Notifications.getPermissionsAsync());
    } catch {
      return 'unsupported';
    }
  },

  async requestPermission() {
    try {
      await ensureSetup();
      return mapStatus(await Notifications.requestPermissionsAsync());
    } catch {
      return 'unsupported';
    }
  },

  async replaceSchedule(items: ScheduledReminder[]) {
    await ensureSetup();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const item of items) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.body,
          data: { ...item.data },
        },
        trigger:
          item.at <= now
            ? null // fire as soon as possible
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(item.at),
                channelId: CHANNEL_ID,
              },
      });
    }
  },

  async clearAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  },

  onResponse(cb) {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = toData(r.notification.request.content.data);
      if (data) cb(data);
    });
    return () => sub.remove();
  },

  async consumeInitialResponse() {
    if (sawInitial) return null;
    sawInitial = true;
    const r = await Notifications.getLastNotificationResponseAsync();
    return r ? toData(r.notification.request.content.data) : null;
  },

  openSystemSettings() {
    void Linking.openSettings();
  },
};

setNotificationsFactory(() => nativeClient);

export {};

export * from './notificationsCore';
