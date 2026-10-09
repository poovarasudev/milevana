import { z } from 'zod';
import { auditFields, odometerValue, optShortText, shortText, timestampSchema } from './common';

// vehicles/{id}/reminders/{reminderId} — SRS "Schemas" reminder shape.
export const reminderDocSchema = z
  .object({
    title: shortText,
    subject: z.object({
      kind: z.enum(['service', 'expense', 'custom']),
      serviceType: optShortText,
      category: optShortText,
    }),
    dateTrigger: z
      .object({
        dueDate: timestampSchema,
        repeatEveryMonths: z.number().int().positive().optional(),
      })
      .optional(),
    odometerTrigger: z
      .object({
        dueOdometer: odometerValue,
        repeatEveryDistance: z.number().positive().optional(),
      })
      .optional(),
    leadDays: z.number().int().nonnegative(),
    leadDistance: z.number().nonnegative(),
    amountMinor: z.number().int().nonnegative().optional(),
    status: z.enum(['active', 'done']),
    completedAt: timestampSchema.optional(),
    completedByEntryId: z.string().min(1).optional(),
    createdBy: z.string().min(1),
    ...auditFields,
  })
  .superRefine((r, ctx) => {
    if (!r.dateTrigger && !r.odometerTrigger) {
      ctx.addIssue({ code: 'custom', message: 'at least one trigger required', path: ['dateTrigger'] });
    }
    if (r.subject.kind === 'service' && !r.subject.serviceType) {
      ctx.addIssue({ code: 'custom', message: 'serviceType required', path: ['subject', 'serviceType'] });
    }
    if (r.subject.kind === 'expense' && !r.subject.category) {
      ctx.addIssue({ code: 'custom', message: 'category required', path: ['subject', 'category'] });
    }
  });

export type ReminderDoc = z.infer<typeof reminderDocSchema>;
