// Theme tokens (FND-SHL-03, DR-04): the light/dark pair mirrors the design
// HTML's blue-on-soft-grey palette. `useTheme` resolves the Theme setting —
// light, dark or system — from the signed-in user's document (repository
// state), so a settings change repaints immediately (AC-D17).

import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { useAppStore } from '../features/appStore';

export const light = {
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1F2937', muted: '#6B7789', primary: '#4C7BD9', // i18n-allow — colour tokens
  primarySoft: '#EAF1FC', primaryOn: '#FFFFFF', border: '#E2E8F0', tile: '#EFF3F8', divider: '#E6EBF2',
  income: '#2E8B7A', incomeSoft: '#E6F4F1', danger: '#C2410C', frame: '#E9EDF4',
};
export const dark: typeof light = {
  bg: '#0F141B', card: '#171E28', text: '#E6EBF2', muted: '#97A3B6', primary: '#7FA3EA', // i18n-allow — colour tokens
  primarySoft: '#1E2B45', primaryOn: '#0F141B', border: '#283142', tile: '#212A38', divider: '#222B3A',
  income: '#5CC2AE', incomeSoft: '#17302B', danger: '#F59E6B', frame: '#090D13',
};
export type Theme = typeof light;
export type ThemeMode = 'system' | 'light' | 'dark';

export function resolveScheme(mode: ThemeMode | undefined, system: 'light' | 'dark' | null): 'light' | 'dark' {
  const scheme = mode === 'system' || mode === undefined ? system : mode;
  return scheme === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  const mode = useAppStore((s) => s.userDoc?.settings.theme);
  const system = useColorScheme();
  return resolveScheme(mode, system === 'dark' ? 'dark' : 'light') === 'dark' ? dark : light;
}

/** Material-3 provider theme matching our tokens (SHL-03 requirement). */
export function usePaperTheme() {
  const scheme = useTheme() === dark ? 'dark' : 'light';
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const colors = scheme === 'dark' ? dark : light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.bg,
      surface: colors.card,
      onSurface: colors.text,
      outline: colors.border,
      error: colors.danger,
    },
  };
}

export const font = { medium: 'Manrope_500Medium', semi: 'Manrope_600SemiBold', bold: 'Manrope_700Bold' };
