import { z } from 'zod';

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60, 'Max 60 characters'),
  type: z.enum(['car', 'bike', 'scooter', 'truck', 'bus', 'other']),
  fuelTypes: z.array(z.enum(['petrol', 'diesel', 'cng', 'lpg', 'electric'])).min(1, 'Pick at least one fuel type'),
  odometerUnit: z.enum(['km', 'mi', 'hrs']),
  odometer: z
    .string()
    .refine((v) => v !== '' && !Number.isNaN(Number(v)), 'Enter a number')
    .refine((v) => Number(v) >= 0 && Number(v) <= 9_999_999, '0 to 9,999,999')
    .refine((v) => /^\d+(\.\d)?$/.test(v), 'One decimal place at most'),
  color: z.string(),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  year: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 1950 && Number(v) <= new Date().getFullYear() + 1), 'Year 1950 to next year'),
  plate: z.string().trim().max(15, 'Max 15 characters').optional(),
});
export type VehicleForm = z.infer<typeof vehicleSchema>;

export const fuelSchema = z.object({
  odometer: z.string().refine((v) => /^\d+(\.\d)?$/.test(v), 'Enter odometer'),
  quantity: z.string().refine((v) => Number(v) > 0, 'Enter quantity'),
  price: z.string().refine((v) => Number(v) > 0, 'Enter price'),
});
