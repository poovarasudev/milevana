// Modal overlays rendered over the stack when ready (FND-AUTH-04..08,
// FND-OBS-04): link prompt, account conflict, merge progress, the sign-out
// pending-writes dialog, and the Sync issues list (DR-19 — kind + name only,
// never amounts, plates or notes).

import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { Button, Card, T } from './kit';
import { useTheme } from './theme';
import { useAppStore } from '../features/appStore';
import {
  conflictBack, conflictCancel, conflictMoveAndSwitch, conflictShowWarning,
  conflictSwitchWithoutMoving, signOutCancel, signOutDiscard, signOutWaitAndSync,
  askDiscardMerge, cancelDiscardMerge, confirmDiscardMerge, resumeMerge, linkGoogle,
} from '../features/auth';
import { dismissLinkPrompt } from '../features/linkPrompt';
import { discardIssue, retryIssue } from '../features/sync';
import { t } from '../i18n';
import { useState } from 'react';

function Sheet({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  const th = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 420, paddingVertical: 24, gap: 14, backgroundColor: th.card }}>
          {children}
        </Card>
      </View>
    </Modal>
  );
}

/** One-shot prompt at the fifth entry (FR-LINK-01). */
export function LinkPromptOverlay() {
  const th = useTheme();
  const visible = useAppStore((s) => s.linkPromptVisible);
  const count = useAppStore((s) => s.entryCountTotal);
  const linking = useAppStore((s) => s.linking);
  if (!visible) return null;
  return (
    <Sheet onClose={() => void dismissLinkPrompt()}>
      <T size={18} weight="semi">{t('linkPrompt.title')}</T>
      <T size={14} color={th.muted}>{t('linkPrompt.body', { count })}</T>
      <Button
        title={t('linkPrompt.link')}
        icon="google"
        disabled={linking}
        onPress={() => void linkGoogle()}
      />
      <Button title={t('linkPrompt.later')} kind="text" onPress={() => void dismissLinkPrompt()} />
    </Sheet>
  );
}

/** credential-already-in-use → Move / Switch-without-moving / Cancel (AC-D5). */
export function ConflictOverlay() {
  const th = useTheme();
  const conflict = useAppStore((s) => s.conflict);
  const warnStep = useAppStore((s) => s.conflictWarnStep);
  if (!conflict) return null;
  const empty = conflict.vehicleCount === 0 && conflict.entryCount === 0;

  if (warnStep) {
    return (
      <Sheet onClose={conflictBack}>
        <T size={18} weight="semi">{t('conflict.warnTitle')}</T>
        <T size={14} color={th.muted}>{t('conflict.warnBody')}</T>
        <Button title={t('conflict.warnConfirm')} kind="danger" onPress={() => void conflictSwitchWithoutMoving()} />
        <Button title={t('common.back')} kind="secondary" onPress={conflictBack} />
      </Sheet>
    );
  }

  if (empty) {
    // Nothing on the phone to move — two-button variant (DR-10 ◐).
    return (
      <Sheet onClose={conflictCancel}>
        <T size={18} weight="semi">{t('conflict.title')}</T>
        <T size={14} color={th.muted}>{t('conflict.zeroBody')}</T>
        <Button title={t('common.switch')} onPress={() => void conflictSwitchWithoutMoving()} />
        <Button title={t('common.cancel')} kind="text" onPress={conflictCancel} />
      </Sheet>
    );
  }

  const vehicles = t('conflict.vehicle', { count: conflict.vehicleCount });
  const entries = t('conflict.entry', { count: conflict.entryCount });
  return (
    <Sheet onClose={conflictCancel}>
      <T size={18} weight="semi">{t('conflict.title')}</T>
      <T size={14} color={th.muted}>{t('conflict.body', { vehicles, entries })}</T>
      <Button title={t('conflict.moveAndSwitch')} onPress={() => void conflictMoveAndSwitch()} />
      <Button title={t('conflict.switchWithoutMoving')} kind="secondary" onPress={conflictShowWarning} />
      <Button title={t('common.cancel')} kind="text" onPress={conflictCancel} />
    </Sheet>
  );
}

/** Blocking progress while a merge runs in-session (AUTH-06). */
export function MergeOverlay() {
  const th = useTheme();
  const merge = useAppStore((s) => s.merge);
  if (merge.status === 'idle') return null;
  return (
    <Sheet>
      {merge.confirmDiscard ? (
        <>
          <T size={18} weight="semi">{t('merge.discardTitle')}</T>
          <T size={14} color={th.muted}>{t('merge.discardBody')}</T>
          <Button title={t('common.discard')} kind="danger" onPress={() => void confirmDiscardMerge()} />
          <Button title={t('common.keep')} kind="secondary" onPress={cancelDiscardMerge} />
        </>
      ) : merge.status === 'moving' ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <ActivityIndicator color={th.primary} size="large" />
          <T size={15} weight="semi">{t('merge.moving')}</T>
        </View>
      ) : (
        <>
          <T size={18} weight="semi">{t('merge.failed')}</T>
          <Button title={t('common.retry')} onPress={() => void resumeMerge()} />
          <Button title={t('common.discard')} kind="text" onPress={askDiscardMerge} />
        </>
      )}
    </Sheet>
  );
}

/** Pending-writes dialog before sign-out (AC-D23, DR-11/DR-16). */
export function SignOutOverlay() {
  const th = useTheme();
  const n = useAppStore((s) => s.signOutPending);
  const online = useAppStore((s) => s.online);
  if (n === null) return null;
  return (
    <Sheet onClose={signOutCancel}>
      <T size={18} weight="semi">{t('signout.dialogTitle')}</T>
      <T size={14} color={th.muted}>{t('signout.body', { count: n })}</T>
      <Button title={t('signout.wait')} onPress={signOutWaitAndSync} />
      <Button title={t('signout.discard')} kind="danger" onPress={() => void signOutDiscard()} />
      <Button title={t('common.cancel')} kind="text" onPress={signOutCancel} />
      <T size={12} color={th.muted}>
        {online ? t('signout.syncing', { count: n }) : t('signout.waiting', { count: n })}
      </T>
    </Sheet>
  );
}

/** Session-scoped rejected writes with Retry / Discard (DR-19). */
export function SyncIssuesOverlay() {
  const th = useTheme();
  const issues = useAppStore((s) => s.syncIssues);
  const vehicles = useAppStore((s) => s.vehicles);
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;
  const label = (issuePath: string): string => {
    const vid = issuePath.split('/')[1];
    const v = vehicles.find((x) => x.id === vid);
    const kind = issuePath.split('/')[2] === 'entries' ? 'entry' : 'vehicle';
    return v ? `${t(`syncIssues.kindLabel.${kind}`)} · ${v.name}` : t(`syncIssues.kindLabel.${kind}`);
  };
  return (
    <>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 90, zIndex: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: th.card, borderWidth: 1, borderColor: th.danger, borderRadius: 14, padding: 12 }}
        >
          <T size={13} weight="semi" color={th.danger} style={{ flex: 1 }}>
            {t('syncIssues.banner', { count: issues.length })}
          </T>
          <T size={13} weight="bold" color={th.primary}>{t('syncIssues.view')}</T>
        </Pressable>
      </View>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <T size={18} weight="semi">{t('syncIssues.title')}</T>
          {issues.map((i) => (
            <View key={i.id} style={{ borderTopWidth: 1, borderTopColor: th.divider, paddingTop: 12, gap: 8 }}>
              <T size={14} weight="semi">
                {i.code === 'permission-denied'
                  ? t('notices.accessLost')
                  : label(i.journal[0]?.path ?? '')}
              </T>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button title={t('syncIssues.retry') ?? t('common.retry')} kind="secondary" onPress={() => retryIssue(i.id)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title={t('common.discard')} kind="text" onPress={() => discardIssue(i.id)} />
                </View>
              </View>
            </View>
          ))}
          <Button title={t('common.close')} kind="secondary" onPress={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
