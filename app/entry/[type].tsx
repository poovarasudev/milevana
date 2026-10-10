// Entry form route (LOG-04/13): Add sheet types open their real forms here;
// `?id=` opens the same form pre-filled for edit (read-only for other
// members' entries and archived vehicles — LD-13/DR-13). An inspection run
// arrives with `?template=<id>` from the picker (CHK-06).

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ENTRY_TYPES, type Timestamp } from '../../src/data/schema/common';
import type { InspectionDetailsDoc } from '../../src/data/schema/entry';
import { useAppStore } from '../../src/features/appStore';
import { isDriveGranted, requestDriveAccess } from '../../src/features/driveAccess';
import { cleanupOneAttachment } from '../../src/features/driveCleanup';
import { canEditEntry, createEntry, requestDelete, updateEntry } from '../../src/features/entries';
import {
  enqueuePendingReceipts, MAX_ATTACHMENTS, pickReceipt, ReceiptError,
  discardPending, toAttachment, uploadPending, type PendingReceipt,
} from '../../src/features/receipts';
import { cancelUpload, retryUpload } from '../../src/features/uploadQueue';
import { t } from '../../src/i18n';
import { AttachmentsSection } from '../../src/ui/entry/AttachmentsSection';
import { EntryForm } from '../../src/ui/entry/EntryForm';
import type { EntryFormResult } from '../../src/ui/entry/types';
import { Header, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

export default function EntryScreen() {
  const th = useTheme();
  const { type, id, vehicle: vid, category, amountMinor, notes, template: templateId } =
    useLocalSearchParams<{
      type: string; id?: string; vehicle?: string; category?: string;
      amountMinor?: string; notes?: string; template?: string;
    }>();
  const kind = (ENTRY_TYPES as readonly string[]).includes(type ?? '') ? type! : 'expense';
  // `?vehicle=` lets a reminder notification open the form on its own
  // vehicle (RD-10); otherwise the selected vehicle applies.
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === (vid ?? s.selectedVehicleId)));
  const entries = useAppStore((s) => (vehicle && s.entriesVehicleId === vehicle.id ? s.entries : []));
  const arrived = useAppStore((s) => s.entriesArrived);
  const entry = id ? entries.find((e) => e.id === id) : undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useAppStore((s) => s.user?.uid);
  const userDoc = useAppStore((s) => s.userDoc);
  const [pendings, setPendings] = useState<PendingReceipt[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [attError, setAttError] = useState<string | null>(null);
  // CHK-07: item-tag changes on already-saved attachments stage until Save,
  // the same way removals do.
  const [tagOverrides, setTagOverrides] = useState<Map<string, string | null>>(new Map());
  const keptAtts = (entry?.attachments ?? []).filter((a) => !removedIds.has(a.id));
  const readonlyEntry = !!vehicle && (vehicle.archived || (entry ? !canEditEntry(entry, vehicle, uid) : false));

  // The inspection run's template comes with the run (CHK-06); the saved
  // entry carries its own snapshot so edits reopen it even after the
  // template changed or was deleted (CHK-10).
  const template = useAppStore((s) =>
    kind === 'inspection' && templateId && s.templatesVehicleId === vehicle?.id
      ? s.templates.find((t) => t.id === templateId)
      : undefined);
  const inspectionDetails = entry?.type === 'inspection'
    ? entry.details as InspectionDetailsDoc | undefined
    : undefined;
  const tagItems = kind === 'inspection'
    ? (inspectionDetails?.items ?? template?.items ?? [])
    : [];

  const addReceipt = async (source: 'camera' | 'gallery' | 'pdf' | 'media') => {
    if (!uid || !vehicle) return;
    setAttError(null);
    // Incremental consent (DRV-04): ask when the Drive feature is first used;
    // declining never blocks the pick — native uploads simply stay queued.
    if (!(await isDriveGranted(uid))) {
      void requestDriveAccess(uid, userDoc?.email ?? undefined);
    }
    try {
      const p = await pickReceipt({
        source,
        existingCount: keptAtts.length + pendings.length,
      });
      if (p) setPendings((ps) => [...ps, p]);
    } catch (e) {
      if (e instanceof ReceiptError) {
        setAttError(
          e.code === 'too-many' ? t('receipts.tooMany', { max: MAX_ATTACHMENTS })
            : e.code === 'pdf-too-large' ? t('receipts.pdfTooLarge')
              : e.code === 'denied' ? t('receipts.denied')
                : t('receipts.failed'));
      } else {
        setAttError(t('receipts.failed'));
      }
    }
  };

  const prefill = !id && (category || amountMinor || notes)
    ? {
        category: category || undefined,
        amountMinor: amountMinor && /^\d+$/.test(amountMinor) ? Number(amountMinor) : undefined,
        notes: notes || undefined,
      }
    : undefined;

  const submit = async (v: EntryFormResult) => {
    if (!vehicle || !uid) return;
    setSaving(true);
    setError(null);
    try {
      const dateTs = ('input' in v ? v.input.date : v.patch.date ?? entry!.date) as Timestamp;
      const entryType = 'input' in v ? v.input.type : entry!.type;
      // Web uploads must finish before the entry is saved (ED-14); a failure
      // aborts the save and marks the pending so it can be retried/removed.
      const ready: PendingReceipt[] = [];
      for (const p of pendings) {
        try {
          ready.push(await uploadPending(uid, vehicle.id, vehicle.name, dateTs, entryType, p));
        } catch (e) {
          setPendings((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'failed' as const } : x)));
          throw e;
        }
      }
      const atts = [
        ...keptAtts.map((a) => {
          if (!tagOverrides.has(a.id)) return a;
          const itemId = tagOverrides.get(a.id) ?? undefined;
          const { itemId: _drop, ...rest } = a;
          return itemId ? { ...rest, itemId } : rest;
        }),
        ...ready.map((p) => toAttachment(uid, p)),
      ];
      let entryId = entry?.id;
      if (entry && 'patch' in v) {
        await updateEntry(vehicle.id, entry.id, { ...v.patch, attachments: atts });
      } else if ('input' in v) {
        entryId = await createEntry(vehicle.id, { ...v.input, attachments: atts });
      }
      // Attachment removals land with the save: cancel their uploads and
      // delete the Drive files (queued retry on failure — DRV-14).
      for (const a of entry?.attachments ?? []) {
        if (removedIds.has(a.id)) {
          void cancelUpload(uid, a.id);
          void cleanupOneAttachment(uid, a);
        }
      }
      // Native staged files join the upload queue under the saved entry (DRV-12).
      if (entryId) {
        await enqueuePendingReceipts(uid, vehicle.id, entryId, dateTs, entryType, ready);
      }
      router.back();
    } catch {
      setError(t('vehicleForm.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={entry ? t('entryForm.editTitle', { type: t(`entryTypes.${kind}`) }) : t(`entryTypes.${kind}`)} />
      {!vehicle ? (
        <T color={th.muted} style={{ padding: 20 }}>{t('addSheet.chooseVehicle')}</T>
      ) : id && !entry ? (
        arrived ? (
          <T color={th.muted} style={{ padding: 20 }}>{t('entryForm.notFound')}</T>
        ) : (
          <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
        )
      ) : (
        <EntryForm
          vehicle={vehicle}
          type={kind}
          entry={entry}
          entries={entries}
          prefill={prefill}
          template={template}
          saving={saving}
          saveError={error}
          attachmentsNode={uid ? (
            <AttachmentsSection
              uid={uid}
              vehicleId={vehicle.id}
              vehicle={vehicle}
              entry={entry}
              attachments={keptAtts}
              pendings={pendings}
              readOnly={readonlyEntry}
              error={attError}
              onAdd={(src) => void addReceipt(src)}
              onRemoveExisting={(att) => setRemovedIds((s) => new Set(s).add(att.id))}
              onRemovePending={(p) => {
                setPendings((ps) => ps.filter((x) => x.id !== p.id));
                void discardPending(uid, p);
              }}
              onRetry={(att) => void retryUpload(uid, att.id)}
              tagOptions={tagItems.length > 0 ? tagItems.map((i) => ({ id: i.id, label: i.label })) : undefined}
              tagFor={(a) => (
                'ownerUid' in a
                  ? (tagOverrides.has(a.id) ? tagOverrides.get(a.id) ?? undefined : a.itemId)
                  : a.itemId
              )}
              onTag={(a, itemId) => {
                if ('ownerUid' in a) {
                  setTagOverrides((m) => new Map(m).set(a.id, itemId));
                } else {
                  setPendings((ps) => ps.map((x) => (
                    x.id === a.id ? { ...x, itemId: itemId ?? undefined } : x
                  )));
                }
              }}
            />
          ) : undefined}
          onSubmit={(v) => void submit(v)}
          onDelete={entry ? () => { requestDelete(vehicle.id, entry); router.back(); } : undefined}
        />
      )}
    </View>
  );
}
