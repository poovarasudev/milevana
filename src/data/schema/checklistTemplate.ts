import { z } from 'zod';
import { auditFields, MAX_TEMPLATE_ITEMS, shortText } from './common';

// vehicles/{id}/checklistTemplates/{templateId} — SRS "Schemas" template shape.
export const templateItemSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(60),
  group: z.string().max(60).optional(),
});

export const checklistTemplateDocSchema = z.object({
  name: shortText,
  items: z.array(templateItemSchema).max(MAX_TEMPLATE_ITEMS),
  createdBy: z.string().min(1),
  ...auditFields,
});
export type ChecklistTemplateDoc = z.infer<typeof checklistTemplateDocSchema>;
