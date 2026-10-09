import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useStore } from '../src/data/store';
import { formatNumber } from '../src/domain/money';
import { VEHICLE_ICON } from '../src/features/entryView';
import { Button, Card, Header, Row } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

export default function Vehicles() {
  const t = useTheme();
  const vehicles = useStore((s) => s.vehicles);
  const select = useStore((s) => s.selectVehicle);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Vehicles" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card style={{ paddingVertical: 4 }}>
          {vehicles.map((v) => (
            <Row key={v.id} icon={VEHICLE_ICON[v.type]} title={v.name} sub={`${formatNumber(v.lastOdometer)} ${v.odometerUnit}${v.archived ? ' · Archived' : ''}`}
              tint={v.color} onPress={() => { select(v.id); router.replace('/(tabs)'); }} />
          ))}
        </Card>
        <Button icon="plus" title="Add vehicle" onPress={() => router.push('/vehicle/new')} />
      </ScrollView>
    </View>
  );
}
