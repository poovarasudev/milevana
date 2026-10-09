import { View } from 'react-native';
import { Button, T } from './kit';
import { useTheme } from './theme';
import { router } from 'expo-router';

export function NoVehicle() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
      <T size={24} weight="semi">Add your first vehicle</T>
      <T color={t.muted}>Everything in Milevana is scoped to a vehicle.</T>
      <Button title="Add vehicle" onPress={() => router.push('/vehicle/new')} />
    </View>
  );
}
