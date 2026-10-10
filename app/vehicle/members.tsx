// Members list (SHR-10/12/13, SD-10): every member sees names, Google emails
// and roles, owner first then by join date. The owner additionally gets
// Remove and Transfer ownership per member — both behind the SD-07
// confirmations (the remove text carries the delayed Drive-access
// statement, PRV-15).

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { sortedMembers } from '../../src/domain/invites';
import { useAppStore } from '../../src/features/appStore';
import { formatDate, useSettings } from '../../src/features/format';
import { removeMember, transferOwnership } from '../../src/features/invites';
import { t } from '../../src/i18n';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Button, Card, Header, Icon, Row, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';
import { ConfirmDialog } from '../../src/ui/VehicleShare';

type Action =
  | { kind: 'remove'; uid: string; name: string }
  | { kind: 'transfer'; uid: string; name: string };

function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const th = useTheme();
  const settings = useSettings();
  const vehicle = useAppStore((s) => s.vehicles.find((v) => v.id === id));
  const uid = useAppStore((s) => s.user?.uid);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <View style={{ flex: 1, backgroundColor: th.bg }}>
        <Header title={t('members.title')} />
      </View>
    );
  }

  const isOwner = vehicle.ownerId === uid;
  const members = sortedMembers(vehicle);
  const nameOf = (muid: string) => vehicle.members[muid]?.name ?? t('members.member');

  const run = async (a: Action) => {
    setBusy(true);
    setError(null);
    try {
      if (a.kind === 'remove') await removeMember(vehicle, a.uid);
      else await transferOwnership(vehicle, a.uid);
      setAction(null);
    } catch {
      setError(t('members.failed'));
      setAction(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={vehicle.name} subtitle={t('vehicles.members', { count: vehicle.memberIds.length })} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card style={{ paddingVertical: 4 }}>
          {members.map((m) => {
            const sub = [
              m.email,
              m.joinedAt ? t('members.joined', { date: formatDate(m.joinedAt, settings.dateFormat) }) : undefined,
            ].filter(Boolean).join(' · ');
            return (
              <View key={m.uid}>
                <Row
                  icon={m.role === 'owner' ? 'crown-outline' : 'account-outline'}
                  title={m.uid === uid
                    ? `${m.name ?? m.email ?? ''} (${t('members.you')})`
                    : m.name ?? m.email ?? '—'}
                  sub={sub || undefined}
                  right={
                    m.role === 'owner' ? (
                      <T size={12} weight="bold" color={th.primary}>{t('members.owner')}</T>
                    ) : isOwner ? (
                      <Icon name="chevron-right" color={th.muted} />
                    ) : undefined
                  }
                />
                {isOwner && m.role !== 'owner' ? (
                  <View style={{ flexDirection: 'row', gap: 20, paddingLeft: 58, paddingBottom: 8 }}>
                    <Button kind="text" title={t('members.remove')} onPress={() => setAction({ kind: 'remove', uid: m.uid, name: nameOf(m.uid) })} />
                    <Button kind="text" title={t('members.transfer')} onPress={() => setAction({ kind: 'transfer', uid: m.uid, name: nameOf(m.uid) })} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>
        {isOwner ? <T size={12} color={th.muted}>{t('members.ownerLeave')}</T> : null}
        {error ? <T size={13} color={th.danger}>{error}</T> : null}
      </ScrollView>
      {action ? (
        <ConfirmDialog
          title={action.kind === 'remove'
            ? t('members.removeTitle', { name: action.name })
            : t('members.transferTitle', { name: action.name })}
          body={action.kind === 'remove'
            ? t('members.removeBody', { vehicle: vehicle.name })
            : t('members.transferBody')}
          confirmLabel={action.kind === 'remove' ? t('members.remove') : t('members.transfer')}
          danger={action.kind === 'remove'}
          busy={busy}
          onCancel={() => setAction(null)}
          onConfirm={() => void run(action)}
        />
      ) : null}
    </View>
  );
}

export default function Members() {
  return (
    <ErrorBoundary screen="members">
      <MembersScreen />
    </ErrorBoundary>
  );
}
