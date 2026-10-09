// Vehicle colour palette (DR-04): exactly 12 fixed ids stored on the document
// (c01..c12 — validated by schema and rules). Each entry has a light- and
// dark-scheme variant chosen for contrast against the card background.

import { dark, light, useTheme } from './theme';

export interface PaletteColor {
  /** Colour used for the vehicle icon/dot. */
  color: string;
  /** Soft wash behind it. */
  soft: string;
}

const LIGHT: Record<string, PaletteColor> = {
  c01: { color: '#4C7BD9', soft: '#EAF1FC' }, // blue
  c02: { color: '#2E8B7A', soft: '#E6F4F1' }, // teal
  c03: { color: '#6D28D9', soft: '#F1EAFC' }, // violet
  c04: { color: '#C2410C', soft: '#FCEEE4' }, // orange
  c05: { color: '#A16207', soft: '#F7F0DC' }, // amber
  c06: { color: '#0E7490', soft: '#E3F1F6' }, // cyan
  c07: { color: '#BE185D', soft: '#FBE8F0' }, // rose
  c08: { color: '#4D7C0F', soft: '#EDF4DF' }, // lime
  c09: { color: '#475569', soft: '#ECEFF3' }, // slate
  c10: { color: '#1F2937', soft: '#E8EAEE' }, // ink
  c11: { color: '#B91C1C', soft: '#FBE7E7' }, // red
  c12: { color: '#0369A1', soft: '#E4F0F8' }, // ocean
};

const DARK: Record<string, PaletteColor> = {
  c01: { color: '#7FA3EA', soft: '#1E2B45' },
  c02: { color: '#5CC2AE', soft: '#17302B' },
  c03: { color: '#A78BFA', soft: '#2A2344' },
  c04: { color: '#F59E6B', soft: '#3A2618' },
  c05: { color: '#E3B93F', soft: '#352C12' },
  c06: { color: '#4FB3CC', soft: '#142E38' },
  c07: { color: '#F072A6', soft: '#3A1A29' },
  c08: { color: '#9CC24A', soft: '#26340F' },
  c09: { color: '#94A3B8', soft: '#232A34' },
  c10: { color: '#CBD5E1', soft: '#272D36' },
  c11: { color: '#F87171', soft: '#3A1C1C' },
  c12: { color: '#5EAADE', soft: '#15293A' },
};

export const PALETTE_IDS = Object.keys(LIGHT); // c01..c12

export function paletteColor(id: string, scheme: 'light' | 'dark' = 'light'): PaletteColor {
  const table = scheme === 'dark' ? DARK : LIGHT;
  return table[id] ?? table.c01;
}

/** Hook form used by UI: picks the variant for the active theme. */
export function usePaletteColor(id: string): PaletteColor {
  const t = useTheme();
  return paletteColor(id, t === dark ? 'dark' : 'light');
}

/** Non-hook variant for tests/logic; `theme` is the resolved scheme object. */
export function paletteFor(id: string, theme: typeof light): PaletteColor {
  return paletteColor(id, theme === dark ? 'dark' : 'light');
}
