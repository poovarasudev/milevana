// FND-DAT-02 (SC-DAT02-*): zod validation of every Appendix E shape, cross-field
// rules, safe parse outcomes and the upgrade-on-read registry.
import { parseDoc, registerUpgrader } from '../upgrade';
import { SCHEMA_VERSION } from '../common';
import { checklistTemplateDocSchema } from '../checklistTemplate';
import { entryDocSchema } from '../entry';
import { inviteDocSchema } from '../invite';
import { reminderDocSchema } from '../reminder';
import { userDocSchema } from '../user';
import { vehicleDocSchema } from '../vehicle';
import * as f from './fixtures';

const ok = (schema: { safeParse(v: unknown): { success: boolean } }, doc: unknown) =>
  schema.safeParse(doc).success;

describe('vehicle schema', () => {
  it('accepts a valid vehicle', () => {
    expect(ok(vehicleDocSchema, f.vehicleDoc)).toBe(true);
  });

  it('requires the owner in memberIds and matching members keys (OQ-34)', () => {
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, ownerId: 'bob' })).toBe(false);
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, members: { alice: f.vehicleDoc.members.alice, bob: { role: 'member', joinedAt: f.past } } })).toBe(false);
  });

  it('caps members at 10', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `u${i}`);
    const members = Object.fromEntries(ids.map((id, i) => [id, { role: i === 0 ? 'owner' : 'member', joinedAt: f.past }]));
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, ownerId: 'u0', memberIds: ids, members })).toBe(false);
  });

  it('rejects unknown currency and bad colours', () => {
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, currency: 'XTS' })).toBe(false);
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, color: '#1E88E5' })).toBe(false);
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, color: 'c13' })).toBe(false);
  });

  it('rejects name over 60 chars and odometer over one decimal', () => {
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, name: 'x'.repeat(61) })).toBe(false);
    expect(ok(vehicleDocSchema, { ...f.vehicleDoc, startOdometer: 12.34 })).toBe(false);
  });
});

describe('entry schema', () => {
  it('accepts fuel, service, expense and trip fixtures', () => {
    expect(ok(entryDocSchema, f.fuelEntryDoc)).toBe(true);
    expect(ok(entryDocSchema, f.serviceEntryDoc)).toBe(true);
    expect(ok(entryDocSchema, f.entryDoc)).toBe(true);
    expect(ok(entryDocSchema, f.tripEntryDoc)).toBe(true);
  });

  it('requires amount for fuel/expense/service/income, forbids it for trip/inspection', () => {
    expect(ok(entryDocSchema, { ...f.fuelEntryDoc, amount: undefined })).toBe(false);
    expect(ok(entryDocSchema, { ...f.tripEntryDoc, amount: { minor: 100, currency: 'INR' } })).toBe(false);
    expect(ok(entryDocSchema, { ...f.entryDoc, amount: { minor: 10.5, currency: 'INR' } })).toBe(false);
    expect(ok(entryDocSchema, { ...f.entryDoc, amount: { minor: -5, currency: 'INR' } })).toBe(false);
    expect(ok(entryDocSchema, { ...f.entryDoc, amount: { minor: 0, currency: 'INR' } })).toBe(false);
  });

  it('category is required for expense/service/income and forbidden elsewhere', () => {
    expect(ok(entryDocSchema, { ...f.entryDoc, category: undefined })).toBe(false);
    expect(ok(entryDocSchema, { ...f.fuelEntryDoc, category: 'fuel' })).toBe(false);
  });

  it('service total must equal lines + labour − discount, floored at zero (LD-03)', () => {
    expect(ok(entryDocSchema, f.serviceEntryDoc)).toBe(true); // 100000+30000-10000=120000
    expect(ok(entryDocSchema, { ...f.serviceEntryDoc, amount: { minor: 119999, currency: 'INR' } })).toBe(false);
    // Negative totals floor at zero.
    const d: Record<string, unknown> = { ...f.serviceEntryDoc, amount: { minor: 0, currency: 'INR' } };
    d.details = { lines: [{ id: 'l1', serviceType: 'oil_change', costMinor: 100 }], discountMinor: 500 };
    expect(ok(entryDocSchema, d)).toBe(true);
  });

  it('caps attachments at 5 and notes at 500 chars', () => {
    const att = { id: 'a', ownerUid: 'alice', mimeType: 'image/jpeg', sizeBytes: 10, status: 'uploaded', sharedWithUids: [] };
    expect(ok(entryDocSchema, { ...f.entryDoc, attachments: Array(6).fill(att) })).toBe(false);
    expect(ok(entryDocSchema, { ...f.entryDoc, attachments: Array(5).fill(att) })).toBe(true);
    expect(ok(entryDocSchema, { ...f.entryDoc, notes: 'x'.repeat(501) })).toBe(false);
  });

  it('inspection issueCount must match failed items', () => {
    const doc = {
      ...f.tripEntryDoc, type: 'inspection',
      details: {
        templateName: 'Annual',
        items: [{ id: 'i1', label: 'Brakes', result: 'fail' }],
        issueCount: 1,
      },
    };
    expect(ok(entryDocSchema, doc)).toBe(true);
    expect(ok(entryDocSchema, { ...doc, details: { ...doc.details, issueCount: 0 } })).toBe(false);
  });
});

describe('reminder / template / invite / user schemas', () => {
  it('reminder requires at least one trigger', () => {
    expect(ok(reminderDocSchema, f.reminderDoc)).toBe(true);
    const noTrigger = { ...f.reminderDoc, odometerTrigger: undefined };
    expect(ok(reminderDocSchema, noTrigger)).toBe(false);
    expect(ok(reminderDocSchema, { ...f.reminderDoc, dateTrigger: { dueDate: f.past } })).toBe(true);
  });

  it('service reminders need a serviceType; expense need a category', () => {
    expect(ok(reminderDocSchema, { ...f.reminderDoc, subject: { kind: 'service' } })).toBe(false);
    expect(ok(reminderDocSchema, { ...f.reminderDoc, subject: { kind: 'expense' } })).toBe(false);
    expect(ok(reminderDocSchema, { ...f.reminderDoc, subject: { kind: 'custom' } })).toBe(true);
  });

  it('templates cap at 50 items', () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ id: `i${i}`, label: `L${i}` }));
    expect(ok(checklistTemplateDocSchema, { ...f.templateDoc, items })).toBe(false);
    expect(ok(checklistTemplateDocSchema, f.templateDoc)).toBe(true);
  });

  it('invite and user docs parse', () => {
    expect(ok(inviteDocSchema, f.inviteDoc)).toBe(true);
    expect(ok(userDocSchema, f.userDoc)).toBe(true);
  });
});

describe('parseDoc — upgrade on read and safe errors', () => {
  it('returns safe codes and paths only (PRV-03)', () => {
    const r = parseDoc('vehicles', vehicleDocSchema, { ...f.vehicleDoc, name: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('invalid');
      expect(r.paths).toContain('name');
      expect(JSON.stringify(r)).not.toContain('42');
    }
  });

  it('skips newer unknown schema versions (DR-03g)', () => {
    const r = parseDoc('vehicles', vehicleDocSchema, { ...f.vehicleDoc, schemaVersion: SCHEMA_VERSION + 1 });
    expect(r).toEqual({ ok: false, code: 'newer-schema', paths: ['schemaVersion'] });
  });

  it('reports missing upgraders as no-upgrader', () => {
    const r = parseDoc('users', userDocSchema, { ...f.userDoc, schemaVersion: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('no-upgrader');
  });

  it('runs a registered upgrader chain', () => {
    registerUpgrader('invites', 0, (d) => ({ ...d, schemaVersion: 1 }));
    const r = parseDoc('invites', inviteDocSchema, { ...f.inviteDoc, schemaVersion: 0 });
    expect(r.ok).toBe(true);
  });
});
