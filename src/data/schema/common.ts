import { z } from 'zod';
import { isSelectableCurrency } from '../../domain/money';

// Stored encodings follow DR-03: lowercase machine ids for enums the SRS does
// not spell out, exact values where the SRS spells them out, colour as a
// palette id, and schemaVersion an integer starting at 1.

export const SCHEMA_VERSION = 1;

// Firestore timestamps are carried as plain { seconds, nanoseconds } objects so
// the same schema serves both SDKs and serialises losslessly to JSON.
export const timestampSchema = z.object({
  seconds: z.number().int(),
  nanoseconds: z.number().int().min(0).max(999_999_999),
});
export type Timestamp = z.infer<typeof timestampSchema>;

export const tsFromMillis = (ms: number): Timestamp => ({
  seconds: Math.floor(ms / 1000),
  nanoseconds: Math.floor((ms % 1000) * 1e6),
});
export const tsToMillis = (t: Timestamp): number => t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);
export const nowTimestamp = (): Timestamp => tsFromMillis(Date.now());

// Text and value caps shared with firestore.rules (DR-05 / DR-06).
export const SHORT_TEXT_MAX = 60;
export const PLATE_MAX = 15;
export const NOTES_MAX = 500;
export const MAX_ATTACHMENTS = 5;
export const MAX_MEMBERS = 10;
export const MAX_TEMPLATE_ITEMS = 50;
export const ODOMETER_MAX = 9_999_999.9;

export const shortText = z.string().trim().min(1).max(SHORT_TEXT_MAX);
export const optShortText = z.string().trim().max(SHORT_TEXT_MAX).optional();
export const notesText = z.string().max(NOTES_MAX);
export const plateText = z.string().trim().max(PLATE_MAX);
export const currencyCode = z.string().refine(isSelectableCurrency, 'unknown currency');

// Odometer: non-negative, at most one decimal, up to 9,999,999.9 (DR-05).
export const odometerValue = z
  .number()
  .nonnegative()
  .max(ODOMETER_MAX)
  .refine((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6, 'one decimal at most');

export const VEHICLE_TYPES = ['car', 'bike', 'scooter', 'truck', 'bus', 'other'] as const;
export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'lpg', 'electric'] as const;
export const ENTRY_TYPES = ['fuel', 'expense', 'service', 'income', 'trip', 'inspection'] as const;
export const MEMBER_ROLES = ['owner', 'member'] as const;
export const ODOMETER_UNITS = ['km', 'mi', 'hours'] as const;
export const PALETTE_IDS = Array.from({ length: 12 }, (_, i) => `c${String(i + 1).padStart(2, '0')}`);

// Colour is stored as a palette id c01..c12 (DR-03, DR-04).
export const colorId = z.string().regex(/^c(0[1-9]|1[0-2])$/, 'not a palette id');

export const moneySchema = z.object({
  minor: z.number().int(),
  currency: currencyCode,
});
export type MoneyDoc = z.infer<typeof moneySchema>;

// The stored placeholder for entries logged while anonymous (DR-02).
export const ANON_AUTHOR_NAME = 'Me';

export const auditFields = {
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  schemaVersion: z.literal(SCHEMA_VERSION),
};

export type DocKind = 'users' | 'vehicles' | 'entries' | 'reminders' | 'invites' | 'checklistTemplates';
