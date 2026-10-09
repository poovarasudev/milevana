import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Entry, Settings, Vehicle } from '../domain/types';

// Local-only store behind a repository-shaped surface. Firestore repositories
// (FND-DAT-05..07) replace this without touching screens.
interface State {
  vehicles: Vehicle[];
  entries: Entry[];
  selectedVehicleId: string | null;
  settings: Settings;
  hydrated: boolean;
  addVehicle: (v: Omit<Vehicle, 'id' | 'archived' | 'createdAt' | 'lastOdometer'>) => string;
  addEntry: (e: Omit<Entry, 'id' | 'pending'>) => void;
  selectVehicle: (id: string) => void;
  setSettings: (s: Partial<Settings>) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const useStore = create<State>()(
  persist(
    (set) => ({
      vehicles: [],
      entries: [],
      selectedVehicleId: null,
      settings: { theme: 'system', efficiency: 'kml' },
      hydrated: false,
      addVehicle: (v) => {
        const id = uid();
        set((s) => ({
          vehicles: [...s.vehicles, { ...v, id, archived: false, createdAt: Date.now(), lastOdometer: v.startOdometer }],
          selectedVehicleId: s.selectedVehicleId ?? id,
        }));
        return id;
      },
      addEntry: (e) =>
        set((s) => ({
          entries: [...s.entries, { ...e, id: uid(), pending: false }],
          vehicles: s.vehicles.map((v) =>
            v.id === e.vehicleId && e.odometer != null && e.odometer > v.lastOdometer
              ? { ...v, lastOdometer: e.odometer }
              : v,
          ),
        })),
      selectVehicle: (id) => set({ selectedVehicleId: id }),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
    }),
    {
      name: 'milevana-local-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        vehicles: s.vehicles,
        entries: s.entries,
        selectedVehicleId: s.selectedVehicleId,
        settings: s.settings,
      }),
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const useSelectedVehicle = () =>
  useStore((s) => s.vehicles.find((v) => v.id === s.selectedVehicleId && !v.archived) ?? s.vehicles.find((v) => !v.archived) ?? null);
