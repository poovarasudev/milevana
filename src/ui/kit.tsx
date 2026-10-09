import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, useTheme } from './theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const t = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? t.text} />;
}

export function T({ children, size = 15, weight = 'medium', color, style, ...rest }: {
  children: ReactNode; size?: number; weight?: keyof typeof font; color?: string; style?: object; numberOfLines?: number; onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Text {...rest} style={[{ fontFamily: font[weight], fontSize: size, color: color ?? t.text }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <T size={11} weight="semi" color={t.muted} style={{ letterSpacing: 1.2, marginBottom: 8 }}>{children}</T>;
}

export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {back && (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Icon name="arrow-left" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <T size={22} weight="semi" style={{ letterSpacing: -0.4 }}>{title}</T>
        {subtitle ? <T size={13} color={t.muted}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 20, borderWidth: 1, borderColor: t.divider, padding: 16 }, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', disabled, icon }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'text'; disabled?: boolean; icon?: IconName;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'secondary' ? t.primarySoft : 'transparent';
  const fg = kind === 'primary' ? t.primaryOn : t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ backgroundColor: bg, opacity: disabled ? 0.5 : 1, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 }}
    >
      {icon ? <Icon name={icon} color={fg} size={20} /> : null}
      <T weight="semi" size={16} color={fg}>{title}</T>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={{ paddingHorizontal: 16, minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: active ? t.primary : t.card, borderWidth: 1, borderColor: active ? t.primary : t.border }}
    >
      <T weight="semi" size={14} color={active ? t.primaryOn : t.text}>{label}</T>
    </Pressable>
  );
}

export function Field({ label, error, suffix, ...rest }: TextInputProps & { label: string; error?: string; suffix?: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Label>{label}</Label>
      <View style={[styles.input, { backgroundColor: t.card, borderColor: error ? t.danger : t.border }]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={t.muted}
          style={{ flex: 1, fontFamily: font.semi, fontSize: 17, color: t.text, paddingVertical: 14 }}
        />
        {suffix ? <T color={t.muted}>{suffix}</T> : null}
      </View>
      {error ? <T size={12} color={t.danger} style={{ marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

export function Row({ icon, title, sub, right, onPress, tint, soft }: {
  icon: IconName; title: string; sub?: string; right?: ReactNode; onPress?: () => void; tint?: string; soft?: string;
}) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 56 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: soft ?? t.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={tint ?? t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <T weight="semi" size={15} numberOfLines={1}>{title}</T>
        {sub ? <T size={13} color={t.muted} numberOfLines={1}>{sub}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
});
