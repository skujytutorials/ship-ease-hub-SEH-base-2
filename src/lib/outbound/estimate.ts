import "server-only";
import { z } from "zod";
import * as terminal from "@/lib/terminal/api";
import { getSettings } from "@/lib/settings";
import { toMinor } from "@/lib/money";
import { markup } from "./pricing";

/**
 * Quick price check: only where from, where to and the weight. Terminal prices it without
 * creating addresses or parcels, so it is an estimate; the exact price (and any duties)
 * comes from the full booking form.
 */

const place = z.object({
  city: z.string().trim().min(1, "Choose a city"),
  state: z.string().trim().min(1, "Choose a state"),
  country: z.string().length(2),
  zip: z.string().trim().optional(),
});

export const estimateSchema = z.object({
  from: place.extend({ country: z.literal("NG") }),
  to: place,
  weightKg: z.coerce.number().min(0.1, "Weight must be at least 0.1 kg").max(70, "For parcels over 70 kg, please contact us"),
});
export type EstimateInput = z.infer<typeof estimateSchema>;

export type EstimateRate = {
  carrierName: string;
  carrierLogo?: string;
  deliveryTime?: string;
  priceMinor: number; // shipping with SEH markup
  dropoffOnly: boolean;
};

export async function quickEstimate(input: EstimateInput) {
  const settings = await getSettings();
  const goods = "General goods";
  const raw = await terminal.getQuickQuotes({
    pickup_address: { city: input.from.city, state: input.from.state, country: "NG" },
    delivery_address: { city: input.to.city, state: input.to.state, country: input.to.country, zip: input.to.zip || undefined },
    parcel: {
      description: goods,
      weight_unit: "kg",
      items: [{ name: goods, description: goods, type: "parcel", currency: "NGN", value: 10_000, quantity: 1, weight: input.weightKg }],
    },
  });

  const rates: EstimateRate[] = raw.map((r) => {
    // Same as full quotes: Terminal's per-shipment service fee is part of SEH's cost
    const serviceFee = Number((r.metadata as { shipment_service_charge?: number } | undefined)?.shipment_service_charge ?? 0);
    return {
      carrierName: r.carrier_name,
      carrierLogo: r.carrier_logo,
      deliveryTime: r.delivery_time,
      priceMinor: markup(toMinor(r.amount + serviceFee), settings),
      dropoffOnly: Boolean(r.pickup_options?.length) && r.pickup_options!.every((o) => o.type === "dropoff"),
    };
  });
  return { international: input.to.country !== "NG", rates: rates.sort((a, b) => a.priceMinor - b.priceMinor) };
}
