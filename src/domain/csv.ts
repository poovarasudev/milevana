// CSV export builder (DRV-15): one combined file per vehicle or all vehicles
// and a date range. Columns follow Appendix E: common columns first, then the
// fuel, service, income, trip and inspection groups — inspection columns are
// always present even when empty (ED-11). Dates are 'YYYY-MM-DD HH:mm' in the
// device time zone, amounts are plain decimals in major units with the
// currency in its own column and digits per ISO 4217 (OQ-31), booleans are
// 'yes'/'no', quoting is RFC 4180 and the file starts with a UTF-8 BOM so a
// spreadsheet shows ₹ correctly (OQ-52). Pure: no platform or repo imports.

import { tsToMillis } from '../data/schema/common';
import type { EntryDoc, FuelDetailsDoc, IncomeDetailsDoc, InspectionDetailsDoc, ServiceDetailsDoc, TripDetailsDoc } from '../data/schema/entry';
import { exponentOf } from './money';
import { serviceTypeLabel } from './entries';

/** Header row in the Appendix E wording (ED-11). */
export const CSV_HEADERS = [
  // common
  'date', 'vehicle', 'type', 'category', 'amount', 'currency', 'odometer', 'odometer unit', 'notes', 'logged by',
  // fuel
  'fuel type', 'quantity', 'unit', 'price per unit', 'full tank', 'missed previous fill-up', 'station', 'charging location',
  // service
  'line items', 'labour', 'discount',
  // income
  'platform',
  // trip
  'start', 'end', 'start odometer', 'end odometer', 'distance', 'from', 'to', 'purpose', 'rate', 'reimbursement',
  // inspection
  'template', 'issue count', 'result summary',
] as const;

export const CSV_BOM = '\uFEFF';
const COLUMN_COUNT = CSV_HEADERS.length;

export interface CsvRow {
  vehicleName: string;
  odometerUnit: string;
  entry: EntryDoc;
}

// --- cell helpers ------------------------------------------------------------

function quoteCell(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD HH:mm` in the device time zone (ED-11). */
export function csvDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Minor units → plain decimal text with the currency's exponent (OQ-31). */
function amountText(minor: number, currency: string): string {
  return (minor / 10 ** exponentOf(currency)).toFixed(exponentOf(currency));
}

/** milli-minor per unit → plain decimal in major units (up to 3 decimals). */
function priceText(milli: number, currency: string): string {
  const major = milli / 1000 / 10 ** exponentOf(currency);
  return String(parseFloat(major.toFixed(6)));
}

const yesNo = (b: boolean | undefined): string => (b ? 'yes' : 'no');
const num = (n: number | undefined): string => (n === undefined ? '' : String(n));

// --- one row -----------------------------------------------------------------

function rowFor({ vehicleName, odometerUnit, entry }: CsvRow): string[] {
  const cells: string[] = new Array(COLUMN_COUNT).fill('');
  const cur = entry.amount?.currency ?? '';

  cells[0] = csvDate(tsToMillis(entry.date));
  cells[1] = vehicleName;
  cells[2] = entry.type;
  cells[3] = entry.category ?? '';
  cells[4] = entry.amount ? amountText(entry.amount.minor, entry.amount.currency) : '';
  cells[5] = cur;
  cells[6] = num(entry.odometer);
  cells[7] = entry.odometer === undefined ? '' : odometerUnit;
  cells[8] = entry.notes ?? '';
  cells[9] = entry.createdByName;

  switch (entry.type) {
    case 'fuel': {
      const d = entry.details as FuelDetailsDoc;
      cells[10] = d.fuelType;
      cells[11] = String(d.quantity);
      cells[12] = d.quantityUnit;
      cells[13] = priceText(d.pricePerUnitMilli, cur);
      cells[14] = yesNo(d.fullTank);
      cells[15] = yesNo(d.missedPrevious);
      cells[16] = d.stationName ?? '';
      cells[17] = d.chargingLocation ?? '';
      break;
    }
    case 'service': {
      const d = entry.details as ServiceDetailsDoc;
      // "Engine oil: 1200; Air filter: 400" (§23.5).
      cells[18] = d.lines
        .map((l) => `${serviceTypeLabel(l.serviceType, l.otherLabel)}: ${amountText(l.costMinor, cur)}`)
        .join('; ');
      cells[19] = d.labourMinor !== undefined ? amountText(d.labourMinor, cur) : '';
      cells[20] = d.discountMinor !== undefined ? amountText(d.discountMinor, cur) : '';
      break;
    }
    case 'income': {
      const d = (entry.details ?? {}) as IncomeDetailsDoc;
      cells[21] = d.platform ?? '';
      break;
    }
    case 'trip': {
      const d = entry.details as TripDetailsDoc;
      cells[22] = csvDate(tsToMillis(d.startAt));
      cells[23] = csvDate(tsToMillis(d.endAt));
      cells[24] = String(d.startOdometer);
      cells[25] = String(d.endOdometer);
      cells[26] = String(d.distance);
      cells[27] = d.from;
      cells[28] = d.to;
      cells[29] = d.purpose;
      cells[30] = d.ratePerUnitMilli !== undefined ? priceText(d.ratePerUnitMilli, cur) : '';
      cells[31] = d.reimbursementMinor !== undefined ? amountText(d.reimbursementMinor, cur) : '';
      break;
    }
    case 'inspection': {
      const d = entry.details as InspectionDetailsDoc;
      cells[32] = d.templateName;
      cells[33] = String(d.issueCount);
      const pass = d.items.filter((i) => i.result === 'pass').length;
      const fail = d.items.filter((i) => i.result === 'fail').length;
      const na = d.items.filter((i) => i.result === 'na').length;
      cells[34] = [
        pass ? `${pass} pass` : '',
        fail ? `${fail} fail` : '',
        na ? `${na} n/a` : '',
      ]
        .filter(Boolean)
        .join(', ');
      break;
    }
    default:
      break; // expense carries only the common columns
  }
  return cells;
}

/**
 * Build the CSV text (BOM + RFC 4180 quoting, CRLF rows). Rows are emitted in
 * the order given — callers sort by date before calling.
 */
export function buildCsv(rows: CsvRow[]): string {
  const lines = [CSV_HEADERS.map(quoteCell).join(',')];
  for (const r of rows) lines.push(rowFor(r).map(quoteCell).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

/** `milevana-export-<vehicle name or all>-<YYYY-MM-DD>.csv` (ED-12). */
export function csvFileName(scopeName: string, d: Date): string {
  const safe = (scopeName || 'all').replace(/[\\/]/g, '-');
  return `milevana-export-${safe}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
}
