// Icon maps (DR-04: fixed Material Community icons per type — no user text).

import type { IconName } from '../ui/kit';
import type { VehicleDoc } from '../data/schema/vehicle';
import type { ParsedEntryDoc } from '../data/schema/entry';
import { ENTRY_TYPES, VEHICLE_TYPES } from '../data/schema/common';

type VehicleType = VehicleDoc['type'];
type EntryType = ParsedEntryDoc['type'];

export const VEHICLE_ICON: Record<VehicleType, IconName> = {
  car: 'car',
  bike: 'motorbike',
  scooter: 'moped',
  truck: 'truck',
  bus: 'bus',
  other: 'shape',
};

export const ENTRY_ICON: Record<EntryType, IconName> = {
  fuel: 'gas-station',
  expense: 'receipt',
  service: 'wrench',
  income: 'cash-plus',
  trip: 'map-marker-path',
  inspection: 'clipboard-check',
};

export { ENTRY_TYPES, VEHICLE_TYPES };
