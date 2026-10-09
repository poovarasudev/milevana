// Left navigation rail for web at ≥768 px (AC-D14, FR-NAV-06). Mounted as the
// Tabs' custom tabBar; the scene is padded left by the same width.

import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { T } from './kit';
import { font, useTheme } from './theme';
import { t } from '../i18n';

export const RAIL_WIDTH = 220;

/** Structural subset of BottomTabBarProps — avoids depending on the package types. */
export interface RailProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, {
    options: {
      title?: unknown;
      tabBarIcon?: (p: { focused: boolean; color: string; size: number }) => ReactNode;
    };
  }>;
  navigation: { navigate: (name: string) => void };
}

export function WebRail({ state, descriptors, navigation }: RailProps) {
  const th = useTheme();
  return (
    <View
      style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: RAIL_WIDTH,
        backgroundColor: th.card, borderRightWidth: 1, borderRightColor: th.divider,
        paddingTop: 24, paddingHorizontal: 12, gap: 4,
      }}
    >
      <T size={18} weight="bold" color={th.primary} style={{ paddingHorizontal: 12, paddingBottom: 20, fontFamily: font.bold }}>
        {t('signin.title')}
      </T>
      {state.routes.map((route, i) => {
        const options = descriptors[route.key]?.options ?? {};
        const focused = state.index === i;
        const label = typeof options.title === 'string' ? options.title : route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={() => navigation.navigate(route.name)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48,
              paddingHorizontal: 12, borderRadius: 12,
              backgroundColor: focused ? th.primarySoft : 'transparent',
            }}
          >
            {options.tabBarIcon?.({ focused, color: focused ? th.primary : th.muted, size: 22 })}
            <T size={14} weight="semi" color={focused ? th.primary : th.muted}>{label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}
