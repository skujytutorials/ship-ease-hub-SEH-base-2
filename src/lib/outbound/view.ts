import type { Shipment } from "@prisma/client";
import type { PriceLine } from "./pricing";
import type { StoredQuote } from "./service";

/** What the browser is allowed to see of an outbound shipment. */
export function quoteView(s: Shipment) {
  const quote = s.rates as unknown as StoredQuote | null;
  const docs = s.regulatoryDocs as { available?: { type: string; name: string; minor: number; free: boolean }[]; selected?: string[] } | null;
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    claimed: Boolean(s.userId),
    international: quote?.international ?? false,
    insurancePremiumMinor: quote?.insurancePremiumMinor ?? 0,
    quotedAt: quote?.quotedAt,
    rates: quote?.rates ?? [],
    documents: docs?.available ?? null,
    selectedDocuments: docs?.selected ?? [],
    selectedRateId: (s.selectedRate as { rateId?: string } | null)?.rateId ?? null,
    dutyPayer: (s.selectedRate as { dutyPayer?: "sender" | "receiver" } | null)?.dutyPayer ?? null,
    pickupOption: s.pickupOption,
    pricing: (s.pricing as PriceLine[] | null) ?? null,
    totalMinor: s.totalMinor,
    currency: s.currency,
    from: s.fromAddress,
    to: s.toAddress,
  };
}
export type QuoteView = ReturnType<typeof quoteView>;
