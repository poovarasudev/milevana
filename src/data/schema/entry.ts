import { z } from 'zod';
import {
  auditFields, ENTRY_TYPES, MAX_ATTACHMENTS, MAX_MEMBERS, moneySchema,
  notesText, odometerValue, optShortText, shortText, timestampSchema,
} from './common';

const WITH_AMOUNT = ['fuel', 'expense', 'service', 'income'] as const;
const WITHOUT_CATEGORY = ['fuel', 'trip', 'inspection'] as const;

// attachments[] per SRS data model + ED-07 status values.
export const attachmentSchema = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(['queued', 'uploading', 'uploaded', 'failed', 'missing']),
  driveFileId: z.string().max(120).optional(),
  sharedWithUids: z.array(z.string().min(1)).max(MAX_MEMBERS),
  itemId: z.string().max(60).optional(), // inspection item tag only (OQ-41)
});
export type AttachmentDoc = z.infer<typeof attachmentSchema>;

export const fuelDetailsSchema = z
  .object({
    fuelType: z.enum(['petrol', 'diesel', 'cng', 'lpg', 'electric']),
    quantity: z
      .number()
      .positive()
      .refine((v) => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6, 'quantity has at most 3 decimals'),
    quantityUnit: z.enum(['L', 'gal_us', 'gal_uk', 'kg', 'kWh']),
    pricePerUnitMilli: z.number().int().positive(),
    fullTank: z.boolean(),
    missedPrevious: z.boolean(),
    stationName: optShortText,
    chargingLocation: z.enum(['home', 'public']).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.chargingLocation !== undefined && d.fuelType !== 'electric') {
      ctx.addIssue({ code: 'custom', message: 'chargingLocation only on electric', path: ['chargingLocation'] });
    }
  });
export type FuelDetailsDoc = z.infer<typeof fuelDetailsSchema>;

export const serviceLineSchema = z.object({
  id: z.string().min(1).max(60),
  serviceType: z.string().min(1).max(60), // lowercase service-type id, or 'other'
  otherLabel: optShortText,
  costMinor: z.number().int().nonnegative(),
});
export const serviceDetailsSchema = z.object({
  lines: z.array(serviceLineSchema).min(1).max(50),
  labourMinor: z.number().int().nonnegative().optional(),
  discountMinor: z.number().int().nonnegative().optional(),
});
export type ServiceDetailsDoc = z.infer<typeof serviceDetailsSchema>;

export const incomeDetailsSchema = z.object({ platform: optShortText }); // LD-07 ◐
export type IncomeDetailsDoc = z.infer<typeof incomeDetailsSchema>;

export const tripDetailsSchema = z.object({
  startAt: timestampSchema,
  endAt: timestampSchema,
  startOdometer: z.number().nonnegative(),
  endOdometer: z.number().nonnegative(),
  distance: z.number().nonnegative(),
  from: z.string().max(60),
  to: z.string().max(60),
  purpose: z.enum(['business', 'personal']),
  ratePerUnitMilli: z.number().int().nonnegative().optional(),
  reimbursementMinor: z.number().int().nonnegative().optional(),
});
export type TripDetailsDoc = z.infer<typeof tripDetailsSchema>;

export const inspectionItemSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(60),
  group: z.string().max(60).optional(),
  result: z.enum(['pass', 'fail', 'na']),
  note: notesText.optional(),
});
export const inspectionDetailsSchema = z.object({
  templateName: shortText,
  items: z.array(inspectionItemSchema).max(50),
  issueCount: z.number().int().nonnegative(),
});
export type InspectionDetailsDoc = z.infer<typeof inspectionDetailsSchema>;

const baseEntry = z.object({
  type: z.enum(ENTRY_TYPES),
  date: timestampSchema,
  odometer: odometerValue.optional(),
  amount: moneySchema.optional(),
  notes: notesText.optional(),
  category: z.string().min(1).max(60).optional(), // name text (DR-03b)
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS),
  uploaderUids: z.array(z.string().min(1)).max(MAX_MEMBERS),
  createdBy: z.string().min(1),
  createdByName: z.string().min(1).max(60),
  updatedBy: z.string().min(1),
  details: z.unknown().optional(),
  ...auditFields,
});

function detailIssues(ctx: z.RefinementCtx, details: unknown, schema: z.ZodTypeAny, required: boolean) {
  if (details === undefined) {
    if (required) ctx.addIssue({ code: 'custom', message: 'details required', path: ['details'] });
    return;
  }
  const r = schema.safeParse(details);
  if (!r.success) {
    for (const i of r.error.issues) {
      ctx.addIssue({ code: 'custom', message: i.code, path: ['details', ...i.path] });
    }
  }
}

export const entryDocSchema = baseEntry.superRefine((e, ctx) => {
  const needsAmount = (WITH_AMOUNT as readonly string[]).includes(e.type);
  if (needsAmount && e.amount === undefined) {
    ctx.addIssue({ code: 'custom', message: 'amount required', path: ['amount'] });
  }
  if (!needsAmount && e.amount !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'amount must be absent', path: ['amount'] });
  }
  if (e.amount !== undefined) {
    // Amounts are always positive; a service total may floor at zero (LD-03).
    if (e.type === 'service' ? e.amount.minor < 0 : e.amount.minor <= 0) {
      ctx.addIssue({ code: 'custom', message: 'amount not positive', path: ['amount', 'minor'] });
    }
  }
  const noCategory = (WITHOUT_CATEGORY as readonly string[]).includes(e.type);
  if (noCategory && e.category !== undefined) {
    ctx.addIssue({ code: 'custom', message: 'category must be absent', path: ['category'] });
  }
  if (!noCategory && e.category === undefined) {
    ctx.addIssue({ code: 'custom', message: 'category required', path: ['category'] });
  }
  switch (e.type) {
    case 'fuel':
      detailIssues(ctx, e.details, fuelDetailsSchema, true);
      break;
    case 'service':
      detailIssues(ctx, e.details, serviceDetailsSchema, true);
      if (e.amount !== undefined && e.details !== undefined) {
        const d = e.details as ServiceDetailsDoc;
        const parsed = serviceDetailsSchema.safeParse(e.details);
        if (parsed.success) {
          const sum = d.lines.reduce((s, l) => s + l.costMinor, 0) + (d.labourMinor ?? 0) - (d.discountMinor ?? 0);
          if (e.amount.minor !== Math.max(0, sum)) {
            ctx.addIssue({ code: 'custom', message: 'service total mismatch', path: ['amount', 'minor'] });
          }
        }
      }
      break;
    case 'income':
      detailIssues(ctx, e.details, incomeDetailsSchema, false);
      break;
    case 'trip':
      detailIssues(ctx, e.details, tripDetailsSchema, true);
      break;
    case 'inspection':
      detailIssues(ctx, e.details, inspectionDetailsSchema, true);
      if (e.details !== undefined) {
        const d = inspectionDetailsSchema.safeParse(e.details);
        if (d.success && d.data.issueCount !== d.data.items.filter((i) => i.result === 'fail').length) {
          ctx.addIssue({ code: 'custom', message: 'issueCount mismatch', path: ['details', 'issueCount'] });
        }
      }
      break;
    case 'expense':
      if (e.details !== undefined) ctx.addIssue({ code: 'custom', message: 'expense has no details', path: ['details'] });
      break;
  }
});

export type EntryDoc = z.infer<typeof baseEntry> & { details?: unknown };
export type ParsedEntryDoc = z.infer<typeof entryDocSchema>;
