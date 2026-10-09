import { Tabs } from 'expo-router';
import { Icon, IconName } from '../../src/ui/kit';
import { font, useTheme } from '../../src/ui/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Dashboard', icon: 'view-dashboard-outline' },
  { name: 'history', title: 'History', icon: 'history' },
  { name: 'reports', title: 'Reports', icon: 'chart-bar' },
  { name: 'more', title: 'More', icon: 'dots-horizontal' },
];

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: t.primary, tabBarInactiveTintColor: t.muted,
      tabBarStyle: { backgroundColor: t.card, borderTopColor: t.divider, height: 64, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: font.semi, fontSize: 12, marginBottom: 6 },
    }}>
      {TABS.map((x) => (
        <Tabs.Screen key={x.name} name={x.name} options={{ title: x.title, tabBarIcon: ({ color }) => <Icon name={x.icon} color={color as string} /> }} />
      ))}
    </Tabs>
  );
}
