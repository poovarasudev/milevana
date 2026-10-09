// On web at ≥768 px forms open as centered dialogs (AC-D14); elsewhere the
// content just fills the page.

import { ReactNode } from 'react';
import { View } from 'react-native';
import { useIsWideWeb } from './kit';
import { useTheme } from './theme';

export function DialogFrame({ children, maxWidth = 560 }: { children: ReactNode; maxWidth?: number }) {
  const wide = useIsWideWeb();
  const th = useTheme();
  if (!wide) return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: th.bg }}>
      <View
        style={{
          width: '100%', maxWidth, backgroundColor: th.card, borderRadius: 24,
          borderWidth: 1, borderColor: th.divider, overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  );
}
