import { z } from 'zod';
import { auditFields, currencyCode, timestampSchema } from './common';

// users/{uid} — SRS data model; every settings key is seeded with defaults on
// creation (DR-03f), including backupFrequency 'weekly' and an empty
// mutedReminderVehicleIds.
export const settingsSchema = z.object({
  currency: currencyCode,
  distanceUnit: z.enum(['km', 'mi']),
  volumeUnit: z.enum(['litres', 'gal_us', 'gal_uk']),
  efficiencyFormat: z.enum(['km_per_l', 'l_per_100km', 'mpg']),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  theme: z.enum(['system', 'light', 'dark']),
  locale: z.string().min(1).max(35),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly', 'off']),
  mutedReminderVehicleIds: z.array(z.string().min(1)),
});
export type SettingsDoc = z.infer<typeof settingsSchema>;

export const driveSchema = z.object({
  rootFolderId: z.string().max(200).optional(),
  backupsFolderId: z.string().max(200).optional(),
  receiptsFolderId: z.string().max(200).optional(),
  lastBackupAt: timestampSchema.optional(),
  lastBackupFileId: z.string().max(200).optional(),
  vehicleFolderIds: z.record(z.string(), z.string().max(200)),
});
export type DriveDoc = z.infer<typeof driveSchema>;

export const deletionSchema = z.object({
  status: z.string().min(1).max(60),
  startedAt: timestampSchema,
  handoffs: z.record(z.string(), z.string().min(1)),
  // Shared vehicles the user chose to delete instead of handing off (VD-05).
  deletes: z.array(z.string().min(1)).optional(),
  completedSteps: z.array(z.string()),
});
export type DeletionDoc = z.infer<typeof deletionSchema>;

export const userDocSchema = z.object({
  displayName: z.string().max(60).optional(),
  email: z.string().max(320).optional(),
  isLinked: z.boolean(),
  settings: settingsSchema,
  drive: driveSchema.optional(),
  deletion: deletionSchema.optional(),
  createdAt: timestampSchema,
  schemaVersion: auditFields.schemaVersion,
});
export type UserDoc = z.infer<typeof userDocSchema>;
