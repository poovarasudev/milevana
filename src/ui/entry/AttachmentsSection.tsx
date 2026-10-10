// Receipt attachments UI (DRV-11/12/13): rows for the entry's saved
// attachments plus the picked-but-unsaved PendingReceipts. Status chips show
// waiting/uploading/uploaded/failed/missing (ED-08..ED-10). An uploaded photo
// shows a thumbnail fetched through the Drive client + LRU cache and opens
// full screen on tap; a PDF opens the system viewer (ED-09). "File no longer
// in Drive" appears when Drive reports the file gone (ED-10). Add/remove is
// hidden in read-only mode; viewing stays available.

import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import type { AttachmentDoc } from '../../data/schema/entry';
import type { EntryRecord } from '../../data/repos/entryRepo';
import {
  MAX_ATTACHMENTS,
  memberReceiptState,
  openInDrive,
  openReceipt,
  receiptSource,
  type PendingReceipt,
} from '../../features/receipts';
import { adapter } from '../../features/runtime';
import { t } from '../../i18n';
import { Icon, IconButton, Label, T } from '../kit';
import { useTheme } from '../theme';

function attLabel(att: { mimeType: string }): string {
  return att.mimeType === 'application/pdf' ? t('receipts.pdfLabel') : t('receipts.photo');
}

function statusLabel(att: AttachmentDoc): string | null {
  switch (att.status) {
    case 'queued': return t('receipts.waiting');
    case 'uploading': return t('receipts.uploading');
    case 'failed': return t('receipts.failed');
    case 'missing': return t('receipts.missing');
    default: return null;
  }
}

function SavedRow({ uid, vehicleId, entry, att, readOnly, onRemove, onRetry }: {
  uid: string;
  vehicleId: string;
  entry: EntryRecord;
  att: AttachmentDoc;
  readOnly?: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const th = useTheme();
  const isImage = att.mimeType.startsWith('image/');
  const [src, setSrc] = useState<{ uri: string; headers?: Record<string, string> } | null>(null);
  const [viewer, setViewer] = useState(false);
  const status = statusLabel(att);

  useEffect(() => {
    let live = true;
    if (att.status === 'uploaded' && isImage) {
      receiptSource(uid, vehicleId, entry, att)
        .then((s) => { if (live) setSrc(s); })
        .catch(() => undefined);
    }
    return () => { live = false; };
  }, [att, entry, isImage, uid, vehicleId]);

  const open = async () => {
    if (att.status !== 'uploaded') return;
    if (isImage) {
      setViewer(true);
    } else {
      await openReceipt(uid, vehicleId, entry, att).catch(() => undefined);
    }
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => void open()}
        disabled={att.status !== 'uploaded'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
      >
        {isImage && src ? (
          <Image
            source={{ uri: src.uri, headers: src.headers }}
            style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.divider }}
            contentFit="cover"
          />
        ) : isImage && att.status === 'uploaded' ? (
          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.divider, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={th.muted} />
          </View>
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.divider, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={att.mimeType === 'application/pdf' ? 'file-pdf-box' : 'image-outline'} color={th.muted} size={20} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <T weight="semi">{attLabel(att)}</T>
          {status ? <T size={12} color={att.status === 'failed' || att.status === 'missing' ? th.danger : th.muted}>{status}</T> : null}
        </View>
      </Pressable>
      {att.status === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ padding: 6 }}>
          <T size={13} weight="semi" color={th.primary}>{t('receipts.retry')}</T>
        </Pressable>
      ) : null}
      {!readOnly ? (
        <IconButton
          icon="close"
          size={18}
          color={th.muted}
          accessibilityLabel={t('receipts.remove')}
          onPress={onRemove}
        />
      ) : null}
      {viewer && src ? (
        <Modal visible animationType="fade" onRequestClose={() => setViewer(false)}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Image
              source={{ uri: src.uri, headers: src.headers }}
              style={{ flex: 1 }}
              contentFit="contain"
            />
            <View style={{ position: 'absolute', top: 48, right: 20 }}>
              <IconButton
                icon="close"
                color="#fff"
                accessibilityLabel={t('common.close')}
                onPress={() => setViewer(false)}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function PendingRow({ p, onRemove }: { p: PendingReceipt; onRemove: () => void }) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.divider, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {p.previewUri && p.mimeType.startsWith('image/') ? (
          <Image source={{ uri: p.previewUri }} style={{ width: 44, height: 44 }} contentFit="cover" />
        ) : (
          <Icon name={p.mimeType === 'application/pdf' ? 'file-pdf-box' : 'image-outline'} color={th.muted} size={20} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <T weight="semi">{attLabel(p)}</T>
        <T size={12} color={p.status === 'failed' ? th.danger : th.muted}>
          {p.status === 'failed' ? t('receipts.failed') : p.status === 'uploaded' ? t('receipts.uploaded') : t('receipts.waiting')}
        </T>
      </View>
      <IconButton
        icon="close"
        size={18}
        color={th.muted}
        accessibilityLabel={t('receipts.remove')}
        onPress={onRemove}
      />
    </View>
  );
}

/**
 * Another member's attachment (SHR-15, SD-09): never rendered in-app. When
 * the uploader's share sync has granted Drive access it shows "Open in
 * Drive" (disabled offline); before that "Shared once <name> opens the
 * app"; a departed uploader the caller never had access to shows "No longer
 * available".
 */
function MemberRow({ uid, vehicle, att }: {
  uid: string;
  vehicle: { memberIds: string[]; members?: Record<string, { name?: string }> };
  att: AttachmentDoc;
}) {
  const th = useTheme();
  const online = useOnline();
  const state = memberReceiptState(att, uid, vehicle);
  const uploaderName = vehicle.members?.[att.ownerUid]?.name;
  const openable = state === 'openable' && online;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Pressable
        accessibilityRole="button"
        disabled={!openable}
        onPress={() => void openInDrive(att)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: th.divider, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={att.mimeType === 'application/pdf' ? 'file-pdf-box' : 'image-outline'} color={th.muted} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="semi">{uploaderName ? `${attLabel(att)} · ${uploaderName}` : attLabel(att)}</T>
          <T
            size={12}
            color={state === 'gone' ? th.danger : openable ? th.primary : th.muted}
          >
            {state === 'openable'
              ? online ? t('receipts.openInDrive') : t('receipts.sharedOffline')
              : state === 'pending'
                ? t('receipts.pendingShare', { name: uploaderName ?? t('receipts.aMember') })
                : t('receipts.noLongerAvailable')}
          </T>
        </View>
        {openable ? <Icon name="open-in-new" color={th.primary} size={18} /> : null}
      </Pressable>
    </View>
  );
}

export function AttachmentsSection({ uid, vehicleId, vehicle, entry, attachments, pendings, readOnly, error, onAdd, onRemoveExisting, onRemovePending, onRetry }: {
  uid: string;
  vehicleId: string;
  /** Needed to classify other members' receipts (SHR-15); omit in tests. */
  vehicle?: { memberIds: string[]; members?: Record<string, { name?: string }> };
  entry?: EntryRecord;
  attachments: AttachmentDoc[];
  pendings: PendingReceipt[];
  readOnly?: boolean;
  error?: string | null;
  onAdd: (source: 'camera' | 'gallery' | 'pdf' | 'media') => void;
  onRemoveExisting: (att: AttachmentDoc) => void;
  onRemovePending: (p: PendingReceipt) => void;
  onRetry: (att: AttachmentDoc) => void;
}) {
  const th = useTheme();
  const web = adapter().platform === 'web';
  const online = useOnline();
  const count = attachments.length + pendings.length;
  const canAdd = !readOnly && count < MAX_ATTACHMENTS && !(web && !online);

  return (
    <View style={{ marginBottom: 20 }}>
      <Label>{t('receipts.title')}</Label>
      <View style={{ borderWidth: 1, borderColor: th.divider, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: th.card }}>
        {entry ? attachments.map((att) => (
          vehicle && memberReceiptState(att, uid, vehicle) !== 'own' ? (
            <MemberRow key={att.id} uid={uid} vehicle={vehicle} att={att} />
          ) : (
            <SavedRow
              key={att.id}
              uid={uid}
              vehicleId={vehicleId}
              entry={entry}
              att={att}
              readOnly={readOnly}
              onRemove={() => onRemoveExisting(att)}
              onRetry={() => onRetry(att)}
            />
          )
        )) : null}
        {pendings.map((p) => (
          <PendingRow key={p.id} p={p} onRemove={() => onRemovePending(p)} />
        ))}
        {count === 0 && !canAdd ? (
          <T size={13} color={th.muted} style={{ paddingVertical: 10 }}> </T>
        ) : null}
        {canAdd ? (
          web ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onAdd('media')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}
            >
              <Icon name="paperclip" color={th.primary} size={18} />
              <T weight="semi" color={th.primary}>{t('receipts.file')}</T>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 10, flexWrap: 'wrap' }}>
              {(['camera', 'gallery', 'pdf'] as const).map((src) => (
                <Pressable
                  key={src}
                  accessibilityRole="button"
                  onPress={() => onAdd(src)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
                >
                  <Icon
                    name={src === 'camera' ? 'camera-outline' : src === 'gallery' ? 'image-outline' : 'file-pdf-box'}
                    color={th.primary}
                    size={18}
                  />
                  <T size={13} weight="semi" color={th.primary}>{t(`receipts.${src}`)}</T>
                </Pressable>
              ))}
            </View>
          )
        ) : null}
      </View>
      {error ? <T size={13} color={th.danger} style={{ marginTop: 8 }}>{error}</T> : null}
    </View>
  );
}

function useOnline(): boolean {
  try {
    return adapter().isOnline();
  } catch {
    return true;
  }
}
