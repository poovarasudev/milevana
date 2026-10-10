import { z } from 'zod';
import { SCHEMA_VERSION, shortText, timestampSchema } from './common';

// invites/{code} — the document id is the 8-character code. Read-only in
// Foundation (FR-SEC-09); the write path is defined by the Sharing sub-project.
export const inviteDocSchema = z.object({
  vehicleId: z.string().min(1),
  vehicleName: shortText,
  ownerId: z.string().min(1),
  ownerName: z.string().max(60),
  createdBy: z.string().min(1),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  usedBy: z.string().min(1).optional(),
  usedAt: timestampSchema.optional(),
  /**
   * The owner mirrors the vehicle's archived flag onto pending invites so a
   * joiner — who cannot read the vehicle — sees "vehicle archived" rather
   * than an opaque join failure (SHR-08; vehicle.archived remains the rule).
   */
  vehicleArchived: z.boolean().optional(),
  schemaVersion: z.literal(SCHEMA_VERSION).optional(),
});
export type InviteDoc = z.infer<typeof inviteDocSchema>;
