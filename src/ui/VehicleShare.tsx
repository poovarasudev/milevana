// Sharing UI under a vehicle row in More → Vehicles (SHR-07/10/11, SD-05/10).
// Owners get Invite + the pending-invite list with expiry and Cancel; members
// get Members + Leave; every shared vehicle row shows the people count.

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import type { InviteRecord } from '../data/repos/inviteRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { displayCode, inviteLink } from '../domain/invites';
import { useAppStore } from '../features/appStore';
import { formatDate, useSettings } from '../features/format';
import {
  cancelInvite, createInvite, leaveVehicle, loadShareState, shareInvite, type ShareState,
} from '../features/invites';
import { RepoError } from '../data/adapter';
import { adapter } from '../features/runtime';
import { t } from '../i18n';
import { Button, Icon, T } from './kit';
import { useTheme } from './theme';

function ActionChip({ icon, label, onPress, danger, disabled }: {
  icon: string; label: string; onPress: () => void; danger?: boolean; disabled?: boolean;
}) {
  const th = useTheme();
  const color = danger ? th.danger : th.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, minHeight: 44, opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={icon as never} color={color} size={18} />
      <T size={13} weight="semi" color={color}>{label}</T>
    </Pressable>
  );
}

/** Leave / confirm dialog (SHR-11, SD-07 wording). */
export function ConfirmDialog({ title, body, confirmLabel, danger = true, busy, onCancel, onConfirm }: {
  title: string; body: string; confirmLabel: string; danger?: boolean;
  busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const th = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: th.card, borderRadius: 20, padding: 20, gap: 14, borderWidth: 1, borderColor: th.border }}>
          <T size={18} weight="semi">{title}</T>
          <T size={14} color={th.muted} style={{ lineHeight: 20 }}>{body}</T>
          <Button title={confirmLabel} kind={danger ? 'danger' : 'primary'} disabled={busy} onPress={onConfirm} />
          <Button title={t('common.cancel')} kind="text" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function InviteRow({ invite, expired, onCancel }: {
  invite: InviteRecord; expired: boolean; onCancel: () => void;
}) {
  const th = useTheme();
  const settings = useSettings();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <T weight="semi" style={{ letterSpacing: 0.5 }}>{displayCode(invite.code)}</T>
        <T size={12} color={expired ? th.danger : th.muted}>
          {expired
            ? t('invite.expired')
            : t('invite.expiresAt', { date: formatDate(invite.expiresAt, settings.dateFormat) })}
        </T>
      </View>
      {/* 'Expired' stays listed until deleted (SD-05); cancel works either way. */}
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ padding: 6, minHeight: 44, justifyContent: 'center' }}>
        <T size={13} weight="semi" color={th.danger}>{t('invite.cancel')}</T>
      </Pressable>
    </View>
  );
}

/**
 * The owner share block under a vehicle row: Invite action, the freshly
 * created invite with its code/link and Share/Copy actions, and the pending
 * invites with expiry + Cancel (SHR-07, SD-05).
 */
export function OwnerShareBlock({ vehicle }: { vehicle: VehicleRecord }) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const [state, setState] = useState<ShareState | null>(null);
  const [fresh, setFresh] = useState<InviteRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWeb = adapter().platform === 'web';

  const reload = useCallback(async () => {
    try {
      setState(await loadShareState(vehicle));
    } catch {
      setState(null);
    }
  }, [vehicle]);

  useEffect(() => {
    let live = true;
    void loadShareState(vehicle)
      .then((s) => { if (live) setState(s); })
      .catch(() => { if (live) setState(null); });
    return () => { live = false; };
  }, [vehicle]);

  const invite = async () => {
    setBusy(true);
    setError(null);
    try {
      const rec = await createInvite(vehicle);
      setFresh(rec);
      setCopied(false);
      await reload();
    } catch (e) {
      if (e instanceof RepoError && e.message === 'invite-limit') setError(t('invite.limit', { max: 5 }));
      else if (e instanceof RepoError && e.message === 'full') setError(t('invite.full', { max: 10 }));
      else if (e instanceof RepoError && (e.code === 'offline' || e.code === 'unavailable')) setError(t('invite.offline'));
      else if (!(e instanceof RepoError && e.code === 'cancelled')) setError(t('invite.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  const share = async (code: string) => {
    const out = await shareInvite(code, vehicle.name);
    if (out === 'copied') setCopied(true);
    else if (out === 'failed') setError(t('invite.createFailed'));
  };

  const pending = state?.pending ?? [];
  const expired = state?.expired ?? [];

  return (
    <View style={{ paddingLeft: 58, paddingBottom: 10, gap: 4 }}>
      {fresh ? (
        <View style={{ borderWidth: 1, borderColor: th.primarySoft, borderRadius: 14, padding: 12, gap: 6, backgroundColor: th.primarySoft, marginBottom: 4 }}>
          <T size={13} weight="semi" color={th.primary}>{t('invite.created')}</T>
          <T size={22} weight="bold" style={{ letterSpacing: 1 }}>{displayCode(fresh.code)}</T>
          <T size={12} color={th.muted} numberOfLines={1}>{inviteLink(fresh.code)}</T>
          <View style={{ flexDirection: 'row', gap: 18, marginTop: 2 }}>
            <ActionChip icon="share-variant" label={isWeb ? t('invite.copyLink') : t('invite.share')} onPress={() => void share(fresh.code)} />
            {copied ? <T size={13} weight="semi" color={th.muted} style={{ alignSelf: 'center' }}>{t('invite.copied')}</T> : null}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <ActionChip
          icon="account-plus-outline"
          label={busy ? t('invite.creating') : t('invite.action')}
          disabled={busy || !online || (state ? !state.canInvite : false)}
          onPress={() => void invite()}
        />
        <ActionChip
          icon="account-multiple-outline"
          label={`${t('members.title')} (${vehicle.memberIds.length})`}
          onPress={() => router.push({ pathname: '/vehicle/members', params: { id: vehicle.id } })}
        />
      </View>
      {state?.blocked === 'full' ? <T size={12} color={th.muted}>{t('invite.full', { max: 10 })}</T> : null}
      {state?.blocked === 'limit' ? <T size={12} color={th.muted}>{t('invite.limit', { max: 5 })}</T> : null}
      {!online ? <T size={12} color={th.muted}>{t('invite.offline')}</T> : null}
      {error ? <T size={12} color={th.danger}>{error}</T> : null}
      {[...pending, ...expired].length > 0 ? (
        <View style={{ borderTopWidth: 1, borderTopColor: th.divider, marginTop: 4, paddingTop: 4 }}>
          {pending.map((i) => (
            <InviteRow key={i.code} invite={i} expired={false} onCancel={() => void cancelInvite(i.code).then(reload)} />
          ))}
          {expired.map((i) => (
            <InviteRow key={i.code} invite={i} expired onCancel={() => void cancelInvite(i.code).then(reload)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Member-side actions under a vehicle row: Members + Leave (SHR-10/11). */
export function MemberShareBlock({ vehicle }: { vehicle: VehicleRecord }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const th = useTheme();

  const leave = async () => {
    setBusy(true);
    setError(null);
    try {
      await leaveVehicle(vehicle);
      setConfirmLeave(false);
    } catch {
      setError(t('members.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ paddingLeft: 58, paddingBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <ActionChip
          icon="account-multiple-outline"
          label={`${t('members.title')} (${vehicle.memberIds.length})`}
          onPress={() => router.push({ pathname: '/vehicle/members', params: { id: vehicle.id } })}
        />
        <ActionChip icon="exit-to-app" label={t('members.leave')} danger onPress={() => setConfirmLeave(true)} />
      </View>
      {error ? <T size={12} color={th.danger}>{error}</T> : null}
      {confirmLeave ? (
        <ConfirmDialog
          title={t('members.leaveTitle', { vehicle: vehicle.name })}
          body={t('members.leaveBody')}
          confirmLabel={t('members.leave')}
          busy={busy}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => void leave()}
        />
      ) : null}
    </View>
  );
}
