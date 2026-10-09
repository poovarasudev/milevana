import { z } from 'zod';
import {
  auditFields, colorId, currencyCode, FUEL_TYPES, MAX_MEMBERS, MEMBER_ROLES,
  odometerValue, ODOMETER_UNITS, optShortText, plateText, shortText,
  timestampSchema, VEHICLE_TYPES,
} from './common';

// members[uid] — the owner's own record may omit name and email until the
// account is linked (DR-02); other members always carry both (join write).
export const memberSchema = z.object({
  role: z.enum(MEMBER_ROLES),
  name: z.string().max(60).optional(),
  email: z.string().max(320).optional(),
  joinedAt: timestampSchema,
  inviteCode: z.string().max(16).optional(),
});
export type Member = z.infer<typeof memberSchema>;

export const vehicleDocSchema = z
  .object({
    name: shortText,
    type: z.enum(VEHICLE_TYPES),
    color: colorId,
    make: optShortText,
    model: optShortText,
    year: z
      .number()
      .int()
      .min(1950)
      .refine((y) => y <= new Date().getFullYear() + 1, 'year too far ahead')
      .optional(),
    plate: plateText.optional(),
    fuelTypes: z
      .array(z.enum(FUEL_TYPES))
      .min(1)
      .max(5)
      .refine((a) => new Set(a).size === a.length, 'duplicate fuel type'),
    odometerUnit: z.enum(ODOMETER_UNITS),
    currency: currencyCode,
    startOdometer: odometerValue, // set at creation, locked once entries exist (DR-01)
    lastOdometer: z.number().nonnegative(),
    lastOdometerAt: timestampSchema,
    ownerId: z.string().min(1),
    memberIds: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_MEMBERS)
      .refine((a) => new Set(a).size === a.length, 'duplicate member'),
    members: z.record(z.string(), memberSchema),
    archived: z.boolean(),
    ...auditFields,
  })
  .superRefine((v, ctx) => {
    // OQ-34: the owner is in memberIds and members keys match memberIds.
    if (!v.memberIds.includes(v.ownerId)) {
      ctx.addIssue({ code: 'custom', message: 'owner not in memberIds', path: ['ownerId'] });
    }
    const keys = Object.keys(v.members).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...v.memberIds].sort())) {
      ctx.addIssue({ code: 'custom', message: 'members keys differ from memberIds', path: ['members'] });
    }
    if (v.members[v.ownerId]?.role !== 'owner') {
      ctx.addIssue({ code: 'custom', message: 'owner member record must have role owner', path: ['members', v.ownerId, 'role'] });
    }
  });

export type VehicleDoc = z.infer<typeof vehicleDocSchema>;

// Form schema (FR-DATA-04): the fields a user enters when adding a vehicle.
// startOdometer is the "current odometer" input. Defined standalone because
// zod can't .pick() from a refined object schema.
export const vehicleInputSchema = z.object({
  name: shortText,
  type: z.enum(VEHICLE_TYPES),
  color: colorId,
  make: optShortText,
  model: optShortText,
  year: z.number().int().min(1950).refine((y) => y <= new Date().getFullYear() + 1, 'year too far ahead').optional(),
  plate: plateText.optional(),
  fuelTypes: z.array(z.enum(FUEL_TYPES)).min(1).max(5)
    .refine((a) => new Set(a).size === a.length, 'duplicate fuel type'),
  odometerUnit: z.enum(ODOMETER_UNITS),
  currency: currencyCode,
  startOdometer: odometerValue,
});
export type VehicleInput = z.infer<typeof vehicleInputSchema>;
