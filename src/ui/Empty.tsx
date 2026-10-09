// Empty states (FR-NAV-08, FR-VEH-13): no vehicle → "Add your first vehicle";
// everything archived → offer Unarchive (newest archived) and Add.

import { router } from 'expo-router';
import { View } from 'react-native';
import { useAppStore } from '../features/appStore';
import { unarchiveVehicle } from '../features/vehicleActions';
import { t } from '../i18n';
import { Button, T } from './kit';
import { useTheme } from './theme';

export function NoVehicle() {
  const th = useTheme();
  const vehicles = useAppStore((s) => s.vehicles);
  const archived = vehicles.filter((v) => v.archived);
  if (archived.length > 0) {
    const newest = [...archived].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds)[0];
    return (
      <View style={{ flex: 1, backgroundColor: th.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
        <T size={24} weight="semi">{t('empty.allArchivedTitle')}</T>
        <T color={th.muted}>{t('empty.allArchivedBody')}</T>
        <Button
          title={t('common.unarchive')}
          kind="secondary"
          onPress={() => void unarchiveVehicle(newest.id)}
        />
        <Button title={t('empty.button')} icon="plus" onPress={() => router.push('/vehicle/new')} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: th.bg, padding: 24, justifyContent: 'center', gap: 16 }}>
      <T size={24} weight="semi">{t('empty.addFirst')}</T>
      <T color={th.muted}>{t('empty.tagline')}</T>
      <Button title={t('empty.button')} icon="plus" onPress={() => router.push('/vehicle/new')} />
    </View>
  );
}
