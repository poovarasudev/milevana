import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useStore } from '../../src/data/store';
import { Card, Header, Icon, IconName, Row, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

const ITEMS: { label: string; icon: IconName; href?: string; soon?: boolean }[] = [
  { label: 'Vehicles', icon: 'car', href: '/vehicles' },
  { label: 'Reminders', icon: 'bell-outline', soon: true },
  { label: 'Checklists', icon: 'clipboard-check-outline', soon: true },
  { label: 'Backup & export', icon: 'upload-outline', soon: true },
  { label: 'Settings', icon: 'cog-outline', href: '/settings' },
  { label: 'Account', icon: 'account-circle-outline', href: '/account' },
  { label: 'About & privacy', icon: 'shield-check-outline', href: '/about' },
];

export default function More() {
  const t = useTheme();
  const count = useStore((s) => s.vehicles.filter((v) => !v.archived).length);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="More" back={false} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16 }}>
        <Card style={{ backgroundColor: t.primarySoft, borderColor: t.primarySoft }}>
          <T weight="semi">Your data isn't backed up</T>
          <T size={13} color={t.muted} style={{ marginTop: 4, lineHeight: 19 }}>
            Entries live only on this phone. Uninstalling now would erase them. Google linking arrives with the account work.
          </T>
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          {ITEMS.map((i) => (
            <Row key={i.label} icon={i.icon} title={i.label} onPress={i.href ? () => router.push(i.href as never) : undefined}
              right={i.soon ? <T size={12} weight="semi" color={t.muted}>Coming soon</T> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {i.label === 'Vehicles' ? <T color={t.muted}>{count}</T> : i.label === 'Account' ? <T color={t.muted}>Guest</T> : null}
                <Icon name="chevron-right" color={t.muted} />
              </View>} />
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
