import { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from './theme';

export function Shell({ children }: { children: ReactNode }) {
  const t = useTheme();
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: t.frame }}>
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 480, backgroundColor: t.bg }}>
        {children}
      </View>
    </View>
  );
}
