import { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useIsWideWeb } from './kit';
import { useTheme } from './theme';

/**
 * Web frame: a 480 px app column below 768 px; full width once the navigation
 * rail takes over (AC-D14, FR-NAV-06).
 */
export function Shell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const wide = useIsWideWeb();
  if (Platform.OS !== 'web') return <>{children}</>;
  if (wide) return <View style={{ flex: 1, backgroundColor: t.bg }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.frame }}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 480, backgroundColor: t.bg }}>
        {children}
      </View>
    </View>
  );
}
