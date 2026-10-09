import { formatMoney, formatNumber } from '../domain/money';
import type { Entry, EntryType, Vehicle } from '../domain/types';
import type { IconName } from '../ui/kit';

export const ENTRY_ICON: Record<EntryType, IconName> = {
  fuel: 'gas-station', expense: 'receipt-text', service: 'wrench', income: 'cash-plus', trip: 'map-marker-distance', inspection: 'clipboard-check',
};
export const ENTRY_LABEL: Record<EntryType, string> = {
  fuel: 'Fuel', expense: 'Expense', service: 'Service', income: 'Income', trip: 'Trip', inspection: 'Inspection',
};
export const VEHICLE_ICON: Record<Vehicle['type'], IconName> = {
  car: 'car', bike: 'motorbike', scooter: 'moped', truck: 'truck', bus: 'bus', other: 'shape',
};

export function shortDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function describe(e: Entry, unit: string) {
  const odo = e.odometer != null ? ` · ${formatNumber(e.odometer)} ${unit}` : '';
  const title =
    e.type === 'fuel' && e.details
      ? `${e.details.fuelType[0].toUpperCase()}${e.details.fuelType.slice(1)} · ${e.details.quantity} L${e.details.fullTank ? ' · Full tank' : ''}`
      : e.notes?.trim() || ENTRY_LABEL[e.type];
  const amount = e.type === 'trip' || e.type === 'inspection' ? '—' : formatMoney(e.amountMinor, '₹', e.type === 'income');
  return { title, sub: `${shortDate(e.date)}${odo}`, amount, income: e.type === 'income' };
}
