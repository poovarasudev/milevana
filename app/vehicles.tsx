// Vehicles list (FND-VEH-03/04): active and archived vehicles with the
// pending-sync icon, "Delete didn't finish" badges, and per-row manage via
// the vehicle detail screen. Selection also possible from the switcher.

import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { displayOdometer, useSettings } from '../src/features/format';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Button, Card, Header, Icon, Row, T } from '../src/ui/kit';
import { Notices } from '../src/ui/Notices';
import { useTheme } from '../src/ui/theme';
import { VehicleGlyph } from '../src/ui/VehicleGlyph';

function VehiclesScreen() {
  const th = useTheme();
  const settings = useSettings();
  const vehicles = useAppStore((s) => s.vehicles);
  const deleteFailedIds = useAppStore((s) => s.deleteFailedIds);
  const active = vehicles.filter((v) => !v.archived);
  const archived = vehicles.filter((v) => v.archived);

  const renderRow = (v: (typeof vehicles)[number]) => {
    const failed = deleteFailedIds.includes(v.id);
    return (
      <View key={v.id}>
        <Row
          icon="car" // unused — replaced by `left`
          left={<VehicleGlyph vehicle={v} />}
          title={v.name}
          sub={`${t(`vehicleTypes.${v.type}`)} · ${displayOdometer(v, settings)}${v.archived ? ` · ${t('vehicles.archived')}` : ''}`}
          onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: v.id } })}
          right={<Icon name="chevron-right" color={th.muted} />}
        />
        {failed ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 58, paddingBottom: 8 }}>
            <Icon name="alert-circle" color={th.danger} size={16} />
            <T size={12} weight="semi" color={th.danger} style={{ flex: 1 }}>{t('vehicles.deleteBadge')}</T>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('vehicles.title')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Notices />
        {vehicles.length === 0 ? (
          <Card><T color={th.muted}>{t('empty.tagline')}</T></Card>
        ) : (
          <>
            {active.length > 0 && <Card style={{ paddingVertical: 4 }}>{active.map(renderRow)}</Card>}
            {archived.length > 0 && (
              <View>
                <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2, marginBottom: 8 }}>
                  {t('vehicles.archived').toUpperCase()}
                </T>
                <Card style={{ paddingVertical: 4, opacity: 0.75 }}>{archived.map(renderRow)}</Card>
              </View>
            )}
          </>
        )}
        <Button icon="plus" title={t('empty.button')} onPress={() => router.push('/vehicle/new')} />
      </ScrollView>
    </View>
  );
}

export default function Vehicles() {
  return (
    <ErrorBoundary screen="vehicles">
      <VehiclesScreen />
    </ErrorBoundary>
  );
}
