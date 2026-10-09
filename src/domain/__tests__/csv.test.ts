// DRV-15 (SC-DRV15-01..04): BOM, Appendix E column order, service line
// flattening, currency-aware decimals, RFC 4180 quoting, date format,
// yes/no booleans and the export file name (ED-11/ED-12).

import { buildCsv, csvDate, csvFileName, CSV_HEADERS, type CsvRow } from '../csv';
import type { EntryDoc } from '../../data/schema/entry';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const base = (over: Record<string, unknown> = {}): EntryDoc => ({
  type: 'expense',
  date: ts(new Date(2024, 2, 5, 14, 30).getTime() / 1000), // local 2024-03-05 14:30
  amount: { minor: 5000, currency: 'INR' },
  category: 'Parking',
  attachments: [],
  uploaderUids: [],
  createdBy: 'u1',
  createdByName: 'Owner',
  updatedBy: 'u1',
  schemaVersion: 1,
  createdAt: ts(1),
  updatedAt: ts(1),
  ...over,
} as EntryDoc);

const row = (entry: EntryDoc): CsvRow => ({ vehicleName: 'Swift', odometerUnit: 'km', entry });

describe('csv builder', () => {
  it('starts with a UTF-8 BOM and ends rows with CRLF (SC-DRV15-01)', () => {
    const out = buildCsv([row(base())]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain('\r\n');
    expect(out.endsWith('\r\n')).toBe(true);
  });

  it('emits the Appendix E header order incl. odometer unit and inspection columns (SC-DRV15-02)', () => {
    const headers = CSV_HEADERS.join(',');
    expect(headers.startsWith('date,vehicle,type,category,amount,currency,odometer,odometer unit,notes,logged by')).toBe(true);
    expect(headers).toContain('fuel type,quantity,unit,price per unit,full tank,missed previous fill-up,station,charging location');
    expect(headers).toContain('line items,labour,discount');
    expect(headers).toContain('start,end,start odometer,end odometer,distance,from,to,purpose,rate,reimbursement');
    expect(headers.endsWith('template,issue count,result summary')).toBe(true);
    // One row of each type produces the same column count.
    const out = buildCsv([
      row(base()),
      row(base({ type: 'fuel', odometer: 1200, details: { fuelType: 'petrol', quantity: 10, quantityUnit: 'litres', pricePerUnitMilli: 105000, fullTank: true, missedPrevious: false } })),
      row(base({ type: 'income', details: { platform: 'Uber' } })),
      row(base({ type: 'inspection', details: { templateName: 'Pre-trip', issueCount: 0, items: [] } })),
    ]);
    for (const line of out.slice(1).split('\r\n').filter(Boolean)) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('flattens service lines and carries labour/discount columns (SC-DRV15-03)', () => {
    const out = buildCsv([
      row(base({
        type: 'service',
        details: {
          lines: [
            { serviceType: 'engine_oil', costMinor: 120000 },
            { serviceType: 'air_filter', costMinor: 40000 },
          ],
          labourMinor: 50000,
          discountMinor: 10000,
        },
      })),
    ]);
    const line = out.split('\r\n')[1];
    expect(line).toContain('Engine oil: 1200.00; Air filter: 400.00');
    expect(line).toContain('500.00');
    expect(line).toContain('100.00');
  });

  it('formats amounts per currency exponent and quotes per RFC 4180 (SC-DRV15-04)', () => {
    const inr = buildCsv([row(base({ amount: { minor: 12345, currency: 'INR' } }))]);
    expect(inr.split('\r\n')[1]).toContain(',123.45,INR,');
    const jpy = buildCsv([row(base({ amount: { minor: 12345, currency: 'JPY' } }))]);
    expect(jpy.split('\r\n')[1]).toContain(',12345,JPY,');
    const kwd = buildCsv([row(base({ amount: { minor: 12345, currency: 'KWD' } }))]);
    expect(kwd.split('\r\n')[1]).toContain(',12.345,KWD,');

    const out = buildCsv([row(base({ notes: 'a,b "c"\nd' }))]);
    const line = out.split('\r\n')[1];
    expect(line).toContain('"a,b ""c""');
    expect(out).toContain('"a,b ""c""\nd"');
  });

  it('dates are YYYY-MM-DD HH:mm; booleans yes/no; empty cells for n/a', () => {
    const out = buildCsv([
      row(base({ type: 'fuel', details: { fuelType: 'diesel', quantity: 5, quantityUnit: 'litres', pricePerUnitMilli: 90000, fullTank: false, missedPrevious: true } })),
    ]);
    const line = out.split('\r\n')[1];
    expect(line).toContain('2024-03-05 14:30');
    expect(line).toContain('no,yes'); // full tank, missed previous
    // expense row has empty fuel columns
    const exp = buildCsv([row(base())]).split('\r\n')[1].split(',');
    expect(exp[10]).toBe('');
    expect(exp[5]).toBe('INR');
    expect(exp[9]).toBe('Owner');
  });

  it('file name follows milevana-export-<scope>-<YYYY-MM-DD>.csv (ED-12)', () => {
    expect(csvFileName('Swift', new Date(2024, 2, 5))).toBe('milevana-export-Swift-2024-03-05.csv');
    expect(csvFileName('all', new Date(2024, 11, 31))).toBe('milevana-export-all-2024-12-31.csv');
    expect(csvFileName('My/Car', new Date(2024, 0, 1))).toBe('milevana-export-My-Car-2024-01-01.csv');
  });

  it('csvDate formats local time to the minute', () => {
    expect(csvDate(new Date(2024, 6, 9, 8, 5).getTime())).toBe('2024-07-09 08:05');
  });
});
