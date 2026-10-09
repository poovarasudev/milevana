import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../src/data/store';
import { formatNumber } from '../src/domain/money';
import { VEHICLE_ICON } from '../src/features/entryView';
import { Button, Icon, Row, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

export default function Switcher() {
  const t = useTheme();
  const allVehicles = useStore((s) => s.vehicles);
  const vehicles = useMemo(() => allVehicles.filter((v) => !v.archived), [allVehicles]);
  const selected = useStore((s) => s.selectedVehicleId);
  const select = useStore((s) => s.selectVehicle);
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <T size={20} weight="semi">Your vehicles</T>
          <T weight="semi" color={t.primary} onPress={() => { router.back(); router.push('/vehicles'); }}>Manage</T>
        </View>
        {vehicles.map((v) => (
          <Row key={v.id} icon={VEHICLE_ICON[v.type]} title={v.name} sub={`${v.type[0].toUpperCase()}${v.type.slice(1)} · ${formatNumber(v.lastOdometer)} ${v.odometerUnit}`}
            tint={v.color} soft={t.tile}
            onPress={() => { select(v.id); router.back(); }}
            right={v.id === selected ? <Icon name="check-circle" color={t.primary} /> : undefined} />
        ))}
        <View style={{ marginTop: 12 }}>
          <Button kind="secondary" icon="plus" title="Add vehicle" onPress={() => { router.back(); router.push('/vehicle/new'); }} />
        </View>
      </View>
    </View>
  );
}
