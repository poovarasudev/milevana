// Reminders list (REM-04/07/08): the vehicle's reminders in OQ-47 order —
// title, due text, status chip and repeat icon per row (RD-11) — plus the
// three quick-add templates, Mark done / Snooze actions, the denied-
// permission notice (RD-08) and the empty state. Rows open the form; an
// amount-bearing reminder also offers "Log expense" (REM-11).

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ReminderRecord } from '../data/repos/reminderRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { tsFromMillis } from '../data/schema/common';
import { opensExpenseForm, SnoozeChoice } from '../domain/reminders';
import { useAppStore } from '../features/appStore';
import { formatDate, useSettings } from '../features/format';
import {
  cancelSnooze, dismissNotifNotice, isReminderSnoozed, markReminderDone,
  openNotifSettings, reminderDueText, reminderRows, ReminderRow, showNotifNotice,
  snoozeReminder,
} from '../features/reminders';
import { t } from '../i18n';
import { Banner, Button, Card, Chip, Icon, IconButton, IconName, T } from './kit';
import { Notices } from './Notices';
import { useTheme } from './theme';

const SUBJECT_ICON: Record<ReminderRecord['subject']['kind'], IconName> = {
  service: 'wrench',
  expense: 'wallet-outline',
  custom: 'bell-outline',
};

export function StatusChip({ status }: { status: ReminderRow['info']['status'] }) {
  const th = useTheme();
  const hot = status === 'overdue' || status === 'dueToday' || status === 'dueSoon';
  const bg = status === 'overdue' ? th.danger : hot ? th.primary : th.tile;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <T size={11} weight="bold" color={hot ? th.primaryOn : th.muted}>{t(`reminders.status.${status}`)}</T>
    </View>
  );
}

function SnoozePicker({ reminderId, onClose }: { reminderId: string; onClose: () => void }) {
  const th = useTheme();
  const pick = (choice: SnoozeChoice) => {
    void snoozeReminder(reminderId, choice);
    onClose();
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, paddingBottom: 10, paddingLeft: 52 }}>
      <T size={12} color={th.muted} style={{ width: '100%' }}>{t('reminders.snoozeTitle')}</T>
      <Chip label={t('reminders.snoozeTomorrow')} onPress={() => pick('tomorrow')} />
      <Chip label={t('reminders.snoozeThreeDays')} onPress={() => pick('threeDays')} />
      <Chip label={t('reminders.snoozeNextWeek')} onPress={() => pick('nextWeek')} />
    </View>
  );
}

export function ReminderRowView({ row, vehicle, onEdit, onLogExpense, focus }: {
  row: ReminderRow;
  vehicle: VehicleRecord;
  onEdit: (id: string) => void;
  onLogExpense: (r: ReminderRecord) => void;
  focus?: boolean;
}) {
  const th = useTheme();
  const settings = useSettings();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const r = row.reminder;
  const snoozed = isReminderSnoozed(r.id);
  const actionable = r.status === 'active' && !vehicle.archived && !snoozed;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: th.divider }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onEdit(r.id)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
          backgroundColor: focus ? th.primarySoft : undefined, borderRadius: 12, paddingHorizontal: 4,
        }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: th.tile, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={SUBJECT_ICON[r.subject.kind]} size={20} color={th.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T weight="semi" numberOfLines={1} style={{ flexShrink: 1 }}>{r.title}</T>
            {row.info.repeating ? <Icon name="repeat" size={14} color={th.muted} /> : null}
            {r.pending ? <Icon name="clock-outline" size={13} color={th.muted} /> : null}
          </View>
          <T size={12} color={th.muted} numberOfLines={2}>
            {reminderDueText(row, vehicle, settings)}
          </T>
          {snoozed && row.snoozedUntilMs ? (
            <T size={12} color={th.primary}>
              {t('reminders.snoozedUntil', { date: formatDate(tsFromMillis(row.snoozedUntilMs), settings.dateFormat) })}
            </T>
          ) : null}
        </View>
        <StatusChip status={row.info.status} />
      </Pressable>
      {(actionable || snoozed) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingBottom: 10, paddingLeft: 52 }}>
          {snoozed ? (
            <Pressable accessibilityRole="button" onPress={() => void cancelSnooze(r.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={13} weight="bold" color={th.primary}>{t('reminders.cancelSnooze')}</T>
            </Pressable>
          ) : (
            <>
              <Pressable accessibilityRole="button" onPress={() => void markReminderDone(vehicle.id, r.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={13} weight="bold" color={th.primary}>{t('reminders.markDone')}</T>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setSnoozeOpen((v) => !v)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={13} weight="bold" color={th.primary}>{t('reminders.snooze')}</T>
              </Pressable>
              {opensExpenseForm(r) ? (
                <Pressable accessibilityRole="button" onPress={() => onLogExpense(r)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <T size={13} weight="bold" color={th.primary}>{t('reminders.logExpense')}</T>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      )}
      {snoozeOpen && actionable ? <SnoozePicker reminderId={r.id} onClose={() => setSnoozeOpen(false)} /> : null}
    </View>
  );
}

/** The three §23.3 quick-add templates — they pre-fill the form only. */
export const REMINDER_PRESETS = ['insurance', 'puc', 'service'] as const;
export type ReminderPreset = (typeof REMINDER_PRESETS)[number];

const PRESET_LABEL: Record<ReminderPreset, string> = {
  insurance: 'reminders.suggestInsurance',
  puc: 'reminders.suggestPuc',
  service: 'reminders.suggestService',
};

export function QuickAddCard({ vehicle, onAdd }: {
  vehicle: VehicleRecord;
  onAdd: (preset?: ReminderPreset) => void;
}) {
  const th = useTheme();
  const presets = REMINDER_PRESETS.filter((p) => p !== 'service' || vehicle.odometerUnit !== 'hours');
  if (vehicle.archived) return null;
  return (
    <Card style={{ marginBottom: 12 }}>
      <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2, marginBottom: 8 }}>
        {t('reminders.quickAdd')}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {presets.map((p) => (
          <Chip key={p} label={t(PRESET_LABEL[p])} onPress={() => onAdd(p)} />
        ))}
      </View>
    </Card>
  );
}

/** The denied-permission notice — one-time, Open settings + dismiss (RD-08). */
export function NotifOffNotice() {
  const th = useTheme();
  const perm = useAppStore((s) => s.notifPermission);
  const dismissed = useAppStore((s) => s.notifNoticeOff);
  void perm; void dismissed; // subscribed so the notice appears/clears live
  if (!showNotifNotice()) return null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.primarySoft,
      borderRadius: 14, padding: 12, marginBottom: 12,
    }}>
      <Icon name="bell-off-outline" color={th.primary} size={20} />
      <View style={{ flex: 1 }}>
        <T size={13} weight="semi" color={th.primary}>{t('reminders.notifOff')}</T>
        <Pressable accessibilityRole="button" onPress={openNotifSettings} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T size={13} weight="bold" color={th.primary}>{t('reminders.openSettings')}</T>
        </Pressable>
      </View>
      <IconButton
        icon="close"
        accessibilityLabel={t('common.close')}
        onPress={() => void dismissNotifNotice()}
        size={18}
        color={th.primary}
      />
    </View>
  );
}

/** Live rows for a vehicle — subscribes to the underlying slices, not the
 *  derived array (getSnapshot must be stable for useSyncExternalStore). */
export function useReminderRows(vehicleId: string): ReminderRow[] {
  const reminders = useAppStore((s) => s.reminders[vehicleId]);
  const snoozes = useAppStore((s) => s.snoozes);
  const vehicles = useAppStore((s) => s.vehicles);
  const entries = useAppStore((s) => s.entries);
  const odoEntries = useAppStore((s) => s.odoEntries);
  return useMemo(
    () => reminderRows(vehicleId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicleId, reminders, snoozes, vehicles, entries, odoEntries],
  );
}

export function RemindersList({ vehicle, focusId, onAdd, onEdit, onLogExpense }: {
  vehicle: VehicleRecord;
  /** Reminder to highlight (a notification tap landed here — RD-10). */
  focusId?: string;
  onAdd: (preset?: ReminderPreset) => void;
  onEdit: (id: string) => void;
  onLogExpense: (r: ReminderRecord) => void;
}) {
  const th = useTheme();
  const rows = useReminderRows(vehicle.id);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 120 }}>
      <Notices />
      <NotifOffNotice />
      {vehicle.archived ? <Banner icon="archive-outline" text={t('reminders.archivedReadonly')} tone="info" /> : null}
      {rows.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 6, marginBottom: 12 }}>
          <Icon name="bell-outline" size={28} color={th.muted} />
          <T size={17} weight="semi">{t('reminders.empty')}</T>
          <T size={13} color={th.muted} style={{ textAlign: 'center' }}>{t('reminders.emptyBody')}</T>
          {!vehicle.archived ? (
            <View style={{ marginTop: 10, alignSelf: 'stretch' }}>
              <Button title={t('reminders.add')} icon="plus" onPress={() => onAdd()} />
            </View>
          ) : null}
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4, marginBottom: 12 }}>
          {rows.map((row) => (
            <ReminderRowView
              key={row.reminder.id}
              row={row}
              vehicle={vehicle}
              focus={row.reminder.id === focusId}
              onEdit={onEdit}
              onLogExpense={onLogExpense}
            />
          ))}
        </Card>
      )}
      <QuickAddCard vehicle={vehicle} onAdd={onAdd} />
    </ScrollView>
  );
}
