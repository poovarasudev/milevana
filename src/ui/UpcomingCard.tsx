// Dashboard "Upcoming & overdue" card (REM-10): at most 3 active, un-snoozed
// reminders in OQ-47 order, a "See all" link and the empty state with an Add
// reminder shortcut (RD-11). A muted vehicle still shows here — mute affects
// only phone notifications (RD-07/OQ-46).

import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { useAppStore } from '../features/appStore';
import { useSettings } from '../features/format';
import { dashboardRows, reminderDueText } from '../features/reminders';
import { t } from '../i18n';
import { Button, Card, Icon, T } from './kit';
import { StatusChip } from './RemindersList';
import { useTheme } from './theme';

/** Active + un-snoozed rows, max 3 — stable-subscription variant of the
 *  feature helper for useSyncExternalStore. */
export function useDashboardRows(vehicleId: string) {
  const reminders = useAppStore((s) => s.reminders[vehicleId]);
  const snoozes = useAppStore((s) => s.snoozes);
  const vehicles = useAppStore((s) => s.vehicles);
  const entries = useAppStore((s) => s.entries);
  const odoEntries = useAppStore((s) => s.odoEntries);
  return useMemo(
    () => dashboardRows(vehicleId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicleId, reminders, snoozes, vehicles, entries, odoEntries],
  );
}

export function UpcomingCard({ vehicle, onOpenReminder, onSeeAll, onAdd }: {
  vehicle: VehicleRecord;
  onOpenReminder: (id: string) => void;
  onSeeAll: () => void;
  onAdd: () => void;
}) {
  const th = useTheme();
  const settings = useSettings();
  const rows = useDashboardRows(vehicle.id);

  return (
    <Card style={{ marginHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <T size={17} weight="semi" style={{ flex: 1 }}>{t('reminders.cardTitle')}</T>
        {rows.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSeeAll}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <T size={13} weight="bold" color={th.primary}>{t('reminders.seeAll')}</T>
          </Pressable>
        ) : null}
      </View>
      {rows.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16, gap: 10 }}>
          <T size={13} color={th.muted}>{t('reminders.noUpcoming')}</T>
          {!vehicle.archived ? (
            <Button kind="secondary" title={t('reminders.add')} icon="plus" onPress={onAdd} />
          ) : null}
        </View>
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.reminder.id}
            accessibilityRole="button"
            onPress={() => onOpenReminder(row.reminder.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
              borderTopWidth: 1, borderTopColor: th.divider, minHeight: 48,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T weight="semi" size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{row.reminder.title}</T>
                {row.info.repeating ? <Icon name="repeat" size={13} color={th.muted} /> : null}
              </View>
              <T size={12} color={th.muted} numberOfLines={1}>
                {reminderDueText(row, vehicle, settings)}
              </T>
            </View>
            <StatusChip status={row.info.status} />
          </Pressable>
        ))
      )}
    </Card>
  );
}
