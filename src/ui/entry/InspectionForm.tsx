// CHK-06..09 — the inspection form. Run mode (`template`, no `entry`) marks
// each item Pass / Fail / N/A with an optional note; unanswered items are
// stored 'na' after a confirmation (CD-04); leaving a started run asks
// before discarding. Edit mode changes results, notes, odometer, date and
// photos on the fixed snapshot items and recomputes issueCount (CD-05).
// The failed items get Create reminder / Log service shortcuts (CD-07) and
// tagged photos render under their item (CD-06).

import { router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { tsFromMillis } from '../../data/schema/common';
import type { AttachmentDoc, InspectionDetailsDoc } from '../../data/schema/entry';
import {
  buildInspection, failedItems, noteTooLong, reminderTitleFor,
  unansweredCount, type InspectionAnswer,
} from '../../domain/checklists';
import { useAppStore } from '../../features/appStore';
import { t } from '../../i18n';
import { ConfirmSheet } from '../ConfirmSheet';
import { Card, Icon, Label, T } from '../kit';
import { font, useTheme } from '../theme';
import { AttachmentThumb } from './AttachmentsSection';
import { EntryShell, readonlyReason, useSharedFields } from './EntryShell';
import { parseOdometer } from './fields';
import type { EntryFormProps } from './types';

type ItemT = { id: string; label: string; group?: string };

interface ItemSection {
  key: string;
  group?: string;
  items: ItemT[];
}

/** Items display under their group in order of first use (CD-01); the
 *  ungrouped bucket sits where its first item appears. */
export function groupItems<T extends ItemT>(items: T[]): ItemSection[] {
  const order: ItemSection[] = [];
  const byKey = new Map<string, ItemSection>();
  for (const it of items) {
    const key = it.group ?? '';
    let s = byKey.get(key);
    if (!s) {
      s = { key, group: it.group, items: [] };
      byKey.set(key, s);
      order.push(s);
    }
    s.items.push(it);
  }
  return order;
}

const RESULTS = ['pass', 'fail', 'na'] as const;

function resultColor(result: 'pass' | 'fail' | 'na', th: ReturnType<typeof useTheme>): string {
  if (result === 'pass') return th.primary;
  if (result === 'fail') return th.danger;
  return th.muted;
}

/** "Create reminder"/"Log service" on one failed item (CD-07). */
function ShortcutRow({ item, vehicleId, vehicleName }: {
  item: { label: string };
  vehicleId: string;
  vehicleName: string;
}) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <T weight="semi" numberOfLines={1}>{item.label}</T>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/reminder/[id]',
            params: {
              id: 'new',
              vehicle: vehicleId,
              title: reminderTitleFor(item.label, vehicleName),
            },
          })}
        style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}
      >
        <T size={13} weight="semi" color={th.primary}>{t('checklists.createReminder')}</T>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/entry/[type]',
            params: {
              type: 'service',
              vehicle: vehicleId,
              notes: t('checklists.serviceFailedNote', { label: item.label }),
            },
          })}
        style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}
      >
        <T size={13} weight="semi" color={th.primary}>{t('checklists.logService')}</T>
      </Pressable>
    </View>
  );
}

export function InspectionForm(props: EntryFormProps) {
  const {
    vehicle, entry, entries, template, prefill, readOnly, saving, saveError,
    attachmentsNode, onSubmit, onDelete,
  } = props;
  const th = useTheme();
  const uid = useAppStore((s) => s.user?.uid);
  const shared = useSharedFields(entry, prefill?.notes);
  const navigation = useNavigation();
  const details = entry?.details as InspectionDetailsDoc | undefined;

  // The run works from the template copy captured when it opened — template
  // edits mid-run never change it (CD-03).
  const [runSource] = useState(() =>
    template ? { name: template.name, items: template.items } : null);
  const items: ItemT[] = entry ? details?.items ?? [] : runSource?.items ?? [];
  const templateName = entry ? details?.templateName ?? '' : runSource?.name ?? '';
  const sections = groupItems(items);
  const atts = entry?.attachments ?? [];
  const failed = details ? failedItems(details) : [];

  const [answers, setAnswers] = useState<Record<string, InspectionAnswer>>(() => {
    const init: Record<string, InspectionAnswer> = {};
    if (details) {
      for (const i of details.items) {
        init[i.id] = { result: i.result, ...(i.note ? { note: i.note } : {}) };
      }
    }
    return init;
  });
  const [noteOpen, setNoteOpen] = useState<Set<string>>(
    () => new Set(details?.items.filter((i) => i.note).map((i) => i.id) ?? []),
  );
  const [confirmUnanswered, setConfirmUnanswered] = useState(0);
  const [pendingNav, setPendingNav] = useState<{ action: unknown } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [noteError, setNoteError] = useState(false);

  const dirty = !entry && (
    Object.values(answers).some((a) => a.result || a.note)
    || shared.odometerText !== ''
    || shared.notes !== ''
  );

  // CD-04: leaving a started run asks for confirmation and discards it.
  // A failed save (saveError) re-arms the prompt — the answers are unsaved.
  useEffect(() => {
    const sub = (navigation as unknown as {
      addListener: (event: 'beforeRemove', cb: (e: { preventDefault: () => void; data: { action: unknown } }) => void) => () => void;
    }).addListener('beforeRemove', (e) => {
      if (!dirty || (submitted && !saveError)) return;
      e.preventDefault();
      setPendingNav({ action: e.data.action });
    });
    return sub;
  }, [navigation, dirty, submitted, saveError]);

  const setResult = (id: string, result: 'pass' | 'fail' | 'na') => {
    setAnswers((a) => {
      const cur = a[id] ?? {};
      const next = { ...a };
      // Tapping the same result again clears the answer (CD-04).
      next[id] = cur.result === result ? { ...cur, result: undefined } : { ...cur, result };
      if (!next[id].result && !next[id].note) delete next[id];
      return next;
    });
  };

  const setNote = (id: string, note: string) => {
    setAnswers((a) => ({ ...a, [id]: { ...(a[id] ?? {}), note } }));
  };

  const finishSave = () => {
    setConfirmUnanswered(0);
    for (const a of Object.values(answers)) {
      if (a.note !== undefined && noteTooLong(a.note)) {
        setNoteError(true);
        return;
      }
    }
    setNoteError(false);
    const snapshot = buildInspection(
      { name: templateName, items },
      new Map(Object.entries(answers)),
    );
    const odometer = parseOdometer(shared.odometerText);
    const notes = shared.notes.trim();
    setSubmitted(true);
    if (entry) {
      onSubmit({
        patch: {
          date: tsFromMillis(shared.date.getTime()),
          odometer: odometer === 'invalid' ? null : odometer ?? null,
          notes: notes || null,
          details: snapshot,
        },
      });
    } else {
      onSubmit({
        input: {
          type: 'inspection',
          date: tsFromMillis(shared.date.getTime()),
          ...(odometer !== undefined && odometer !== 'invalid' ? { odometer } : {}),
          ...(notes ? { notes } : {}),
          details: snapshot,
        },
      });
    }
  };

  const trySave = () => {
    const n = unansweredCount(items, new Map(Object.entries(answers)));
    if (n > 0) setConfirmUnanswered(n);
    else finishSave();
  };

  const photosFor = (itemId: string): AttachmentDoc[] => atts.filter((a) => a.itemId === itemId);
  const knownIds = new Set(items.map((i) => i.id));
  const untagged = atts.filter((a) => !a.itemId || !knownIds.has(a.itemId));

  const itemRow = (item: ItemT) => {
    const answer = answers[item.id];
    const photos = photosFor(item.id);
    return (
      <Card key={item.id} style={{ paddingVertical: 12, marginBottom: 8 }}>
        <T weight="semi" size={15}>{item.label}</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {RESULTS.map((r) => {
            const active = answer?.result === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={`${t(`checklists.${r}`)} — ${item.label}`}
                accessibilityState={{ selected: active }}
                disabled={readOnly}
                onPress={() => setResult(item.id, r)}
                style={{
                  flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: active ? resultColor(r, th) : th.tile,
                  opacity: readOnly && !active ? 0.4 : 1,
                }}
              >
                <T size={13} weight="semi" color={active ? '#FFFFFF' : th.text}>{t(`checklists.${r}`)}</T>
              </Pressable>
            );
          })}
        </View>
        {noteOpen.has(item.id) || answer?.note !== undefined ? (
          <TextInput
            accessibilityLabel={`${t('checklists.noteLabel')} — ${item.label}`}
            placeholder={t('checklists.noteLabel')}
            placeholderTextColor={th.muted}
            value={answer?.note ?? ''}
            onChangeText={(v) => setNote(item.id, v)}
            maxLength={500}
            editable={!readOnly}
            multiline
            style={{
              fontFamily: font.medium, fontSize: 14, color: th.text, marginTop: 10,
              borderWidth: 1, borderColor: th.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
            }}
          />
        ) : (
          !readOnly ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNoteOpen((s) => new Set(s).add(item.id))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 36 }}
            >
              <Icon name="note-plus-outline" size={16} color={th.primary} />
              <T size={13} weight="semi" color={th.primary}>{t('checklists.addNote')}</T>
            </Pressable>
          ) : null
        )}
        {photos.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {photos.map((a) => (
              <AttachmentThumb
                key={a.id}
                uid={uid ?? ''}
                vehicleId={vehicle.id}
                vehicle={vehicle}
                entry={entry!}
                att={a}
              />
            ))}
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <>
      <EntryShell
        shared={shared}
        vehicle={vehicle}
        entries={entries}
        excludeId={entry?.id}
        odometerMode="optional"
        readOnly={readOnly}
        readonlyReason={readonlyReason(vehicle, entry)}
        saving={saving}
        error={saveError}
        submitLabel={t('checklists.saveInspection')}
        attachments={attachmentsNode}
        onSubmit={trySave}
        onDelete={onDelete}
      >
        <Label>{templateName}</Label>
        {sections.map((sec) => (
          <View key={sec.key}>
            {sec.group ? <Label>{sec.group}</Label> : null}
            {sec.items.map(itemRow)}
          </View>
        ))}
        {noteError ? (
          <T size={13} color={th.danger} style={{ marginBottom: 12 }}>{t('entryForm.textTooLong')}</T>
        ) : null}
        {entry && untagged.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <Label>{t('receipts.title')}</Label>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {untagged.map((a) => (
                <AttachmentThumb
                  key={a.id}
                  uid={uid ?? ''}
                  vehicleId={vehicle.id}
                  vehicle={vehicle}
                  entry={entry}
                  att={a}
                />
              ))}
            </View>
          </View>
        ) : null}
        {entry && !vehicle.archived && failed.length > 0 ? (
          <Card style={{ marginBottom: 16 }}>
            <T weight="semi" size={15}>{t('checklists.summaryTitle')}</T>
            {failed.map((i) => (
              <ShortcutRow key={i.id} item={i} vehicleId={vehicle.id} vehicleName={vehicle.name} />
            ))}
          </Card>
        ) : null}
      </EntryShell>

      {confirmUnanswered > 0 ? (
        <ConfirmSheet
          title={t('checklists.saveInspection')}
          body={t('checklists.unanswered', { count: confirmUnanswered })}
          confirmLabel={t('checklists.saveInspection')}
          cancelLabel={t('checklists.keepRunning')}
          onConfirm={finishSave}
          onCancel={() => setConfirmUnanswered(0)}
        />
      ) : null}
      {pendingNav ? (
        <ConfirmSheet
          title={t('checklists.discardTitle')}
          body={t('checklists.discardBody')}
          confirmLabel={t('checklists.discardAction')}
          cancelLabel={t('checklists.keepRunning')}
          danger
          onConfirm={() => {
            setSubmitted(true);
            (navigation as unknown as { dispatch: (a: unknown) => void }).dispatch(pendingNav.action);
          }}
          onCancel={() => setPendingNav(null)}
        />
      ) : null}
    </>
  );
}
