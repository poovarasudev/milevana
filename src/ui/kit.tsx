import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import {
  Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, light, useTheme } from './theme';
import { t } from '../i18n';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/** ≥768 px on web switches to the navigation rail + dialog forms (AC-D14). */
export function useIsWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 768;
}

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const th = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? th.text} />;
}

export function T({ children, size = 15, weight = 'medium', color, style, ...rest }: {
  children: ReactNode; size?: number; weight?: keyof typeof font; color?: string; style?: object; numberOfLines?: number; onPress?: () => void;
}) {
  const th = useTheme();
  return (
    <Text {...rest} style={[{ fontFamily: font[weight], fontSize: size, color: color ?? th.text }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children }: { children: ReactNode }) {
  const th = useTheme();
  return <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2, marginBottom: 8 }}>{children}</T>;
}

/**
 * Icon-only button. `accessibilityLabel` is REQUIRED — an icon button without
 * a screen-reader label is a type error (SC-SHL03-01). Tap target ≥ 48 dp.
 */
export function IconButton({ icon, onPress, accessibilityLabel, size = 22, color, disabled }: {
  icon: IconName; onPress: () => void; accessibilityLabel: string;
  size?: number; color?: string; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Header({ title, subtitle, back = true, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const th = useTheme();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {back && (
        <IconButton
          icon="arrow-left"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      )}
      <View style={{ flex: 1 }}>
        <T size={22} weight="semi" style={{ letterSpacing: -0.4 }}>{title}</T>
        {subtitle ? <T size={13} color={th.muted}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const th = useTheme();
  return <View style={[{ backgroundColor: th.card, borderRadius: 20, borderWidth: 1, borderColor: th.divider, padding: 16 }, style]}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', disabled, icon }: {
  title: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'text' | 'danger'; disabled?: boolean; icon?: IconName;
}) {
  const th = useTheme();
  const bg = kind === 'primary' ? th.primary : kind === 'secondary' ? th.primarySoft : kind === 'danger' ? th.danger : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? '#FFFFFF' : th.primary;
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

export function Chip({ label, active, onPress, disabled }: { label: string; active?: boolean; onPress?: () => void; disabled?: boolean }) {
  const th = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{ paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', borderRadius: 999, backgroundColor: active ? th.primary : th.card, borderWidth: 1, borderColor: active ? th.primary : th.border, opacity: disabled ? 0.5 : 1 }}
    >
      <T weight="semi" size={14} color={active ? th.primaryOn : th.text}>{label}</T>
    </Pressable>
  );
}

export function Field({ label, error, suffix, ...rest }: TextInputProps & { label: string; error?: string; suffix?: string }) {
  const th = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Label>{label}</Label>
      <View style={[styles.input, { backgroundColor: th.card, borderColor: error ? th.danger : th.border }]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={th.muted}
          style={{ flex: 1, fontFamily: font.semi, fontSize: 17, color: th.text, paddingVertical: 14 }}
        />
        {suffix ? <T color={th.muted}>{suffix}</T> : null}
      </View>
      {error ? <T size={12} color={th.danger} style={{ marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

export function Row({ icon, title, sub, right, onPress, tint, soft, left }: {
  icon: IconName; title: string; sub?: string; right?: ReactNode; onPress?: () => void; tint?: string; soft?: string;
  /** Custom leading visual replacing the icon tile (e.g. VehicleGlyph). */
  left?: ReactNode;
}) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 56 }}>
      {left ?? (
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: soft ?? th.tile, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} color={tint ?? th.text} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T weight="semi" size={15} numberOfLines={1}>{title}</T>
        {sub ? <T size={13} color={th.muted} numberOfLines={1}>{sub}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Warning/info banner strip (sync issues, offline, quota, access). */
export function Banner({ icon, text, action, onAction, tone = 'warn' }: {
  icon: IconName; text: string; action?: string; onAction?: () => void; tone?: 'warn' | 'info';
}) {
  const th = useTheme();
  const warnBg = th === light ? '#FDF3E4' : '#33291A';
  const bg = tone === 'warn' ? warnBg : th.primarySoft;
  const fg = tone === 'warn' ? th.danger : th.primary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg, borderRadius: 14, padding: 12, marginBottom: 12 }}>
      <Icon name={icon} color={fg} size={20} />
      <T size={13} weight="semi" color={fg} style={{ flex: 1 }}>{text}</T>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}>
          <T size={13} weight="bold" color={fg}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
});
