// Modal option picker: a read-only row that opens a scrollable sheet of
// options. Used for Settings rows and the vehicle currency override.

import { ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Icon, Label, T } from './kit';
import { useTheme } from './theme';
import { t } from '../i18n';

export interface PickerOption {
  value: string;
  label: string;
  sub?: string;
}

export function Picker({ label, valueLabel, options, onPick, disabled }: {
  label: string;
  valueLabel: ReactNode;
  options: PickerOption[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const th = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52,
          borderWidth: 1, borderRadius: 16, paddingHorizontal: 16,
          backgroundColor: th.card, borderColor: th.border, opacity: disabled ? 0.5 : 1,
        }}
      >
        <View style={{ flex: 1 }}><T weight="semi" size={16}>{valueLabel}</T></View>
        <Icon name="chevron-down" color={th.muted} />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} accessibilityLabel={t('common.close')} />
          <View style={{ backgroundColor: th.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', padding: 16 }}>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  onPress={() => { onPick(o.value); setOpen(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12, paddingHorizontal: 8 }}
                >
                  <View style={{ flex: 1 }}>
                    <T weight="semi">{o.label}</T>
                    {o.sub ? <T size={13} color={th.muted}>{o.sub}</T> : null}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
