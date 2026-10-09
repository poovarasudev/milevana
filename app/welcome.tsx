import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Icon, IconName, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'cancel', title: 'No ads, ever', body: 'No ad SDK and no location permission.' },
  { icon: 'cloud-off-outline', title: 'Log anywhere', body: 'Every entry saves offline and syncs later.' },
  { icon: 'lock-open-outline', title: 'Your data is never paywalled', body: 'Backup, sync, restore and export stay free.' },
];

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
      <T size={12} weight="semi" color={t.primary} style={{ letterSpacing: 1.4 }}>WELCOME TO MILEVANA</T>
      <T size={34} weight="semi" style={{ letterSpacing: -1, marginTop: 8, lineHeight: 38 }}>Add your first vehicle</T>
      <T size={15} color={t.muted} style={{ marginTop: 12, lineHeight: 22 }}>
        No sign-in needed. Track fuel, services and running costs, then link Google whenever you want a backup.
      </T>
      <View style={{ gap: 12, marginTop: 32, flex: 1 }}>
        {PRINCIPLES.map((p) => (
          <Card key={p.title} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={p.icon} color={t.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <T weight="semi">{p.title}</T>
              <T size={13} color={t.muted}>{p.body}</T>
            </View>
          </Card>
        ))}
      </View>
      <Button title="Add vehicle" onPress={() => router.push('/vehicle/new')} />
    </View>
  );
}
