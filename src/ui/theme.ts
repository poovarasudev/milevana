import { useColorScheme } from 'react-native';
import { useStore } from '../data/store';

const light = {
  bg: '#F7F9FC', card: '#FFFFFF', text: '#1F2937', muted: '#6B7789', primary: '#4C7BD9',
  primarySoft: '#EAF1FC', primaryOn: '#FFFFFF', border: '#E2E8F0', tile: '#EFF3F8', divider: '#E6EBF2',
  income: '#2E8B7A', incomeSoft: '#E6F4F1', danger: '#C2410C',
};
const dark: typeof light = {
  bg: '#0F141B', card: '#171E28', text: '#E6EBF2', muted: '#97A3B6', primary: '#7FA3EA',
  primarySoft: '#1E2B45', primaryOn: '#0F141B', border: '#283142', tile: '#212A38', divider: '#222B3A',
  income: '#5CC2AE', incomeSoft: '#17302B', danger: '#F59E6B',
};
export type Theme = typeof light;

export function useTheme(): Theme {
  const mode = useStore((s) => s.settings.theme);
  const system = useColorScheme();
  const scheme = mode === 'system' ? system : mode;
  return scheme === 'dark' ? dark : light;
}

export const font = { medium: 'Manrope_500Medium', semi: 'Manrope_600SemiBold', bold: 'Manrope_700Bold' };
export const VEHICLE_COLORS = ['#4C7BD9', '#2E8B7A', '#1F2937', '#C2410C', '#7C3AED', '#B45309'];
