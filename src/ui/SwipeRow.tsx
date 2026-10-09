// Swipe-to-delete row wrapper (LOG-14, LD-12): dragging left reveals the
// Delete action; releasing past the threshold commits the Undo-window delete.

import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { ReactNode, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { t } from '../i18n';
import { Icon, T } from './kit';
import { useTheme } from './theme';

export function SwipeToDelete({ onDelete, disabled, children }: {
  onDelete: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const th = useTheme();
  const ref = useRef<{ close: () => void } | null>(null);
  return (
    <ReanimatedSwipeable
      ref={ref as never}
      enabled={!disabled}
      friction={2}
      rightThreshold={48}
      renderRightActions={() => (
        <View style={{ width: 88, justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={() => { ref.current?.close(); onDelete(); }}
            style={{
              width: 64, height: 64, borderRadius: 20, backgroundColor: th.danger,
              alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
          >
            <Icon name="delete" color="#FFFFFF" size={22} />
            <T size={11} weight="bold" color="#FFFFFF">{t('common.delete')}</T>
          </Pressable>
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') onDelete();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
