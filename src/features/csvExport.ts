// CSV export (DRV-15/16): build one combined CSV for a vehicle or all
// vehicles over a Reports range (default All time, Custom supported), then
// hand it to the user — Android share sheet or browser download. No Google
// account or Drive grant is needed, and on Android it works offline from the
// Firestore cache (SC-DRV16-04). 'All vehicles' excludes archived vehicles
// unless the toggle is on (ED-12).

import { getRepos } from './runtime';
import { shareOut } from '../data/shareOut';
import { inPeriod, ReportPeriod, resolveRange, ReportRangeId } from '../domain/reports';
import { buildCsv, csvFileName, CsvRow } from '../domain/csv';
import { tsToMillis } from '../data/schema/common';
import type { VehicleRecord } from '../data/repos/vehicleRepo';

export interface CsvExportOptions {
  /** 'all' or a vehicle id. */
  scope: 'all' | string;
  range: ReportRangeId;
  custom?: { start: Date; end: Date };
  /** Only for scope 'all' — default off (ED-12). */
  includeArchived?: boolean;
  now?: Date;
}

export interface CsvExportResult {
  text: string;
  fileName: string;
  vehicleCount: number;
  entryCount: number;
}

/** Build the CSV text + file name; nothing is written or shared yet. */
export async function buildCsvExport(opts: CsvExportOptions): Promise<CsvExportResult> {
  const repos = getRepos();
  const all = await repos.vehicles.listMine();
  const now = opts.now ?? new Date();

  const vehicles: VehicleRecord[] =
    opts.scope === 'all'
      ? all.filter((v) => opts.includeArchived || !v.archived)
      : all.filter((v) => v.id === opts.scope);

  const rows: CsvRow[] = [];
  for (const v of vehicles) {
    const period: ReportPeriod | null = resolveRange(opts.range, {
      now,
      createdAt: v.createdAt,
      custom: opts.custom,
    });
    const entries = await repos.entries.list(v.id);
    for (const e of entries) {
      if (period && !inPeriod(e.date, period)) continue;
      rows.push({ vehicleName: v.name, odometerUnit: v.odometerUnit, entry: e });
    }
  }
  // One combined file sorted by entry date.
  rows.sort((a, b) => tsToMillis(a.entry.date) - tsToMillis(b.entry.date));

  const scopeName =
    opts.scope === 'all' ? 'all' : (vehicles[0]?.name ?? 'vehicle');
  return {
    text: buildCsv(rows),
    fileName: csvFileName(scopeName, now),
    vehicleCount: vehicles.length,
    entryCount: rows.length,
  };
}

/** Build and deliver; returns false when sharing is unavailable. */
export async function exportCsv(opts: CsvExportOptions): Promise<CsvExportResult | null> {
  const out = await buildCsvExport(opts);
  const ok = await shareOut().shareText(out.fileName, out.text, 'text/csv');
  return ok ? out : null;
}
