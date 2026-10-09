export type VehicleType = 'car' | 'bike' | 'scooter' | 'truck' | 'bus' | 'other';
export type FuelType = 'petrol' | 'diesel' | 'cng' | 'lpg' | 'electric';
export type DistanceUnit = 'km' | 'mi' | 'hrs';
export type EntryType = 'fuel' | 'expense' | 'service' | 'income' | 'trip' | 'inspection';

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  fuelTypes: FuelType[];
  odometerUnit: DistanceUnit;
  startOdometer: number;
  lastOdometer: number;
  color: string;
  make?: string;
  model?: string;
  year?: number;
  plate?: string;
  archived: boolean;
  createdAt: number;
}

export interface FuelDetails {
  fuelType: FuelType;
  quantity: number; // litres
  pricePerUnitMinor: number;
  fullTank: boolean;
  missedFill: boolean;
}

export interface Entry {
  id: string;
  vehicleId: string;
  type: EntryType;
  date: number; // epoch ms
  odometer?: number;
  amountMinor: number;
  notes?: string;
  details?: FuelDetails;
  pending: boolean;
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type EfficiencyFormat = 'kml' | 'l100' | 'mpg';

export interface Settings {
  theme: ThemeMode;
  efficiency: EfficiencyFormat;
}
