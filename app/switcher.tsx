// Vehicle switcher sheet (FND-SHL-04): non-archived vehicles with name, type
// icon and colour, plus "All vehicles" which rescopes Reports only (AC-D25).
// Selection is persisted per uid via the session module (DR-15).

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { displayOdometer, useSettings } from '../src/features/format';
import { VEHICLE_ICON } from '../src/features/icons';
import { selectAllVehicles, selectVehicle } from '../src/features/session';
import { t } from '../src/i18n';
import { backOrHome, Button, Icon, Row, T } from '../src/ui/kit';
import { paletteColor } from '../src/ui/palette';
import { useTheme, dark } from '../src/ui/theme';

export default function Switcher() {
  const th = useTheme();
  const settings = useSettings();
  const allVehicles = useAppStore((s) => s.vehicles);
  const vehicles = useMemo(() => allVehicles.filter((v) => !v.archived), [allVehicles]);
  const selected = useAppStore((s) => s.selectedVehicleId);
  const reportsAll = useAppStore((s) => s.reportsAllVehicles);
  const scheme = th === dark ? 'dark' : 'light';

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={backOrHome} accessibilityLabel={t('common.close')} />
      <View style={{ backgroundColor: th.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <T size={20} weight="semi">{t('nav.yourVehicles')}</T>
          <T weight="semi" color={th.primary} onPress={() => { router.back(); router.push('/vehicles'); }}>
            {t('nav.manage')}
          </T>
        </View>
        {vehicles.map((v) => {
          const p = paletteColor(v.color, scheme);
          return (
            <Row
              key={v.id}
              icon={VEHICLE_ICON[v.type]}
              title={v.name}
              sub={`${t(`vehicleTypes.${v.type}`)} · ${displayOdometer(v, settings)}`}
              tint={p.color}
              soft={p.soft}
              onPress={() => { void selectVehicle(v.id); backOrHome(); }}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {v.memberIds.length > 1 ? (
                    <>
                      <Icon name="account-multiple-outline" color={th.muted} size={18} />
                      <T size={13} weight="semi" color={th.muted}>{v.memberIds.length}</T>
                    </>
                  ) : null}
                  {v.id === selected && !reportsAll ? <Icon name="check-circle" color={th.primary} /> : null}
                </View>
              }
            />
          );
        })}
        {vehicles.length > 1 && (
          <Row
            icon="car-multiple"
            title={t('nav.allVehicles')}
            sub={t('nav.allVehiclesHint')}
            tint={th.muted}
            soft={th.tile}
            onPress={() => { selectAllVehicles(); backOrHome(); }}
            right={reportsAll ? <Icon name="check-circle" color={th.primary} /> : undefined}
          />
        )}
        <View style={{ marginTop: 12 }}>
          <Button
            kind="secondary"
            icon="plus"
            title={t('empty.button')}
            onPress={() => { router.back(); router.push('/vehicle/new'); }}
          />
        </View>
      </View>
    </View>
  );
}
