// Join screen (SHR-08/09, SD-01/03/04/11): opened from a typed code or the
// /join/<code> invite link. Shows the vehicle and owner names carried by the
// invite, walks anonymous users through linking (the pending join resumes
// after the conflict path), then joins and offers to open the vehicle. Every
// failure state has its own message — SHR-08.

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { InviteRecord } from '../../src/data/repos/inviteRepo';
import { displayCode } from '../../src/domain/invites';
import { useAppStore } from '../../src/features/appStore';
import { JoinError, joinWithInvite, lookupInvite, type InviteLookup } from '../../src/features/invites';
import { adapter } from '../../src/features/runtime';
import { selectVehicle } from '../../src/features/session';
import { t } from '../../src/i18n';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Button, Card, Header, Icon, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=dev.poovarasu.milevana';

function failureText(reason: string): string {
  switch (reason) {
    case 'used': return t('join.used');
    case 'expired': return t('join.expired');
    case 'full': return t('join.full', { max: 10 });
    case 'archived': return t('join.archived');
    case 'gone': return t('join.gone');
    case 'invalid': return t('join.invalid');
    case 'offline': return t('join.offline');
    default: return t('join.failed');
  }
}

function JoinScreen({ code }: { code: string }) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const [lookup, setLookup] = useState<InviteLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [joined, setJoined] = useState<InviteRecord | null>(null);

  useEffect(() => {
    let live = true;
    void lookupInvite(code).then((r) => { if (live) setLookup(r); });
    return () => { live = false; };
  }, [code]);

  const join = async (invite: InviteRecord) => {
    setBusy(true);
    setFailure(null);
    try {
      await joinWithInvite(invite);
      setJoined(invite);
    } catch (e) {
      const reason = e instanceof JoinError ? e.reason : 'error';
      if (reason !== 'cancelled') setFailure(reason); // a declined link gate is silent
    } finally {
      setBusy(false);
    }
  };

  const openVehicle = () => {
    router.replace('/');
  };

  const web = adapter().platform === 'web';

  let body: React.ReactNode;
  if (joined) {
    body = (
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check-circle" color={th.primary} />
          <T weight="semi" style={{ flex: 1 }}>{t('join.joined', { vehicle: joined.vehicleName })}</T>
        </View>
        <Button title={t('join.open')} onPress={openVehicle} />
        {web ? (
          <Button kind="secondary" title={t('join.getApp')} onPress={() => window.open(PLAY_URL, '_blank', 'noopener')} />
        ) : null}
      </Card>
    );
  } else if (!lookup) {
    body = <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />;
  } else if (lookup.status === 'valid' || lookup.status === 'archived') {
    const invite = lookup.invite;
    if (lookup.status === 'archived') {
      body = <StateCard text={t('join.archived')} code={code} />;
    } else {
      body = (
        <Card style={{ gap: 12 }}>
          <T size={13} weight="semi" color={th.muted}>{displayCode(code)}</T>
          <T size={18} weight="semi">{invite.vehicleName}</T>
          <T size={14} color={th.muted}>
            {t('join.invitedBy', { owner: invite.ownerName || invite.vehicleName, vehicle: invite.vehicleName })}
          </T>
          {failure ? <T size={13} color={th.danger}>{failureText(failure)}</T> : null}
          {!online ? <T size={13} color={th.muted}>{t('join.offline')}</T> : null}
          <Button
            title={busy ? t('join.joining') : t('join.joinButton')}
            disabled={busy || !online}
            onPress={() => void join(invite)}
          />
        </Card>
      );
    }
  } else if (lookup.status === 'member') {
    body = (
      <Card style={{ gap: 12 }}>
        <T weight="semi">{t('join.member')}</T>
        <Button
          title={t('join.open')}
          onPress={() => { void selectVehicle(lookup.vehicleId).finally(openVehicle); }}
        />
      </Card>
    );
  } else {
    body = <StateCard text={failureText(lookup.status)} code={code} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('join.title')} />
      <View style={{ padding: 20, gap: 16 }}>{body}</View>
    </View>
  );
}

function StateCard({ text, code }: { text: string; code: string }) {
  const th = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      {code ? <T size={13} weight="semi" color={th.muted}>{displayCode(code)}</T> : null}
      <T weight="semi">{text}</T>
      <Button kind="secondary" title={t('join.title')} onPress={() => router.replace('/join')} />
    </Card>
  );
}

export default function JoinByCode() {
  const { code } = useLocalSearchParams<{ code: string }>();
  // key remounts JoinScreen when the code param changes so prior lookup/join
  // state can't leak between codes.
  return (
    <ErrorBoundary screen="join">
      <JoinScreen key={code ?? ''} code={code ?? ''} />
    </ErrorBoundary>
  );
}
