import { z } from "zod";

// Shared by the Send-a-parcel wizard (client) and the API routes (server).

export const addressSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone number with country code"),
  line1: z.string().trim().min(3, "Street address is required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  country: z.string().length(2),
  zip: z.string().trim().min(1, "Postcode is required"),
});
export type AddressForm = z.infer<typeof addressSchema>;

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required"),
  description: z.string().trim().min(1, "Describe the item"),
  type: z.enum(["parcel", "document"]),
  value: z.number().positive("Value must be more than 0"),
  quantity: z.number().int().positive(),
  weight: z.number().positive("Weight must be more than 0"),
  hs_code: z.string().trim().optional(),
});

export const parcelSchema = z.object({
  packaging: z.string().min(1), // Terminal packaging_id
  description: z.string().trim().optional(),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

export const quoteSchema = z
  .object({
    from: addressSchema.refine((a) => a.country === "NG", "Parcels must be sent from Nigeria"),
    to: addressSchema,
    parcels: z.array(parcelSchema).min(1).max(10),
    purpose: z.enum(["personal", "commercial", "sample", "return-after-repair", "return-for-repair"]),
  });
export type QuoteInput = z.infer<typeof quoteSchema>;

export const selectSchema = z.object({
  rateId: z.string().min(1),
  pickupOption: z.enum(["pickup", "priority_pickup", "scheduled_pickup", "dropoff"]).optional(),
  dropoffId: z.string().optional(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  insurance: z.boolean(),
  documents: z.array(z.string()).default([]),
  // International only: duties paid now (in our price) or by the receiver on delivery (the default)
  dutyPayer: z.enum(["sender", "receiver"]).optional(),
});
export type SelectInput = z.infer<typeof selectSchema>;

export const claimSchema = z.object({
  reason: z.enum(["lost-in-transit", "damage"]),
  description: z.string().trim().min(20, "Please describe what happened (20+ characters)"),
  witnesses: z.array(z.tuple([z.string(), z.string()])).max(3).default([]),
});
