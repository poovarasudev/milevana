// Four tabs, same routes on Android and web (FND-SHL-02). On web at ≥768 px
// the bottom bar becomes a left navigation rail (AC-D14); below that it is the
// mobile layout (FR-NAV-10).

import { Tabs } from 'expo-router';
import { Icon, IconName, useIsWideWeb } from '../../src/ui/kit';
import { font, useTheme } from '../../src/ui/theme';
import { RAIL_WIDTH, WebRail } from '../../src/ui/WebRail';
import { t } from '../../src/i18n';

const TABS: { name: string; titleKey: string; icon: IconName }[] = [
  { name: 'index', titleKey: 'tabs.dashboard', icon: 'view-dashboard-outline' },
  { name: 'history', titleKey: 'tabs.history', icon: 'history' },
  { name: 'reports', titleKey: 'tabs.reports', icon: 'chart-bar' },
  { name: 'more', titleKey: 'tabs.more', icon: 'dots-horizontal' },
];

export default function TabsLayout() {
  const th = useTheme();
  const wide = useIsWideWeb();
  return (
    <Tabs
      tabBar={wide ? (props) => <WebRail {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: th.primary,
        tabBarInactiveTintColor: th.muted,
        tabBarStyle: wide
          ? { display: 'none' }
          : { backgroundColor: th.card, borderTopColor: th.divider, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.semi, fontSize: 12, marginBottom: 6 },
        sceneStyle: wide ? { marginLeft: RAIL_WIDTH, backgroundColor: th.bg } : { backgroundColor: th.bg },
      }}
    >
      {TABS.map((x) => (
        <Tabs.Screen
          key={x.name}
          name={x.name}
          options={{
            title: t(x.titleKey),
            tabBarIcon: ({ color }) => <Icon name={x.icon} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
