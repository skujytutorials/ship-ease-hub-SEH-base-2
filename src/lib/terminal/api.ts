import "server-only";
import { terminalDownload, terminalRequest as req } from "./client";
import type * as T from "./types";

/**
 * Every Terminal Africa endpoint Ship Ease Hub uses, one function each.
 * Grouped as in https://docs.terminal.africa/tship/llms.txt
 */

type Page = { page?: number; perPage?: number };

// ---------- Geography ----------
export const getCountries = () => req<T.Country[]>("GET", "/countries");
export const getStates = (country_code: string) => req<T.State[]>("GET", "/states", { query: { country_code } });
export const getCities = (country_code: string, state_code?: string) =>
  req<T.City[]>("GET", "/cities", { query: { country_code, state_code } });

// ---------- Addresses ----------
export const createAddress = (body: T.AddressInput) => req<T.Address>("POST", "/addresses", { body });
export const getAddresses = (q: Page = {}) => req<Record<string, unknown>>("GET", "/addresses", { query: q });
export const getAddress = (id: string) => req<T.Address>("GET", `/addresses/${id}`);
export const updateAddress = (id: string, body: Partial<T.AddressInput>) => req<T.Address>("PUT", `/addresses/${id}`, { body });
export const validateAddress = (body: Pick<T.AddressInput, "line1" | "line2" | "city" | "state" | "country" | "zip">) =>
  req<T.AddressValidation>("POST", "/addresses/validate", { body });
export const verifyAddressNin = (id: string, nin: string) =>
  req<T.Address>("POST", `/addresses/${id}/verify-nin`, { body: { nin } });

// ---------- Packaging ----------
export const getDefaultPackaging = () => req<T.Packaging>("GET", "/packaging/default/terminal");
export const getPackaging = (q: Page = {}) => req<{ packaging: T.Packaging[] }>("GET", "/packaging", { query: q });
export const getPackagingById = (id: string) => req<T.Packaging>("GET", `/packaging/${id}`);
export const createPackaging = (body: T.PackagingInput) => req<T.Packaging>("POST", "/packaging", { body });
export const updatePackaging = (id: string, body: Partial<T.PackagingInput>) =>
  req<T.Packaging>("PUT", `/packaging/${id}`, { body });

// ---------- Parcels ----------
export const createParcel = (body: T.ParcelInput) => req<T.Parcel>("POST", "/parcels", { body });
export const getParcel = (id: string) => req<T.Parcel>("GET", `/parcels/${id}`);
export const updateParcel = (id: string, body: Partial<T.ParcelInput>) => req<T.Parcel>("PUT", `/parcels/${id}`, { body });

// ---------- HS codes ----------
export const searchHsCodes = (query_string: string, q: Page = {}) =>
  req<unknown>("GET", "/hs-codes/simplified/search/query", { query: { query_string, ...q } });

// ---------- Shipments ----------
export const createShipment = (body: {
  address_from: string;
  address_to: string;
  address_return?: string;
  parcel?: string;
  parcels?: string[];
  shipment_purpose?: T.ShipmentPurpose;
  shipment_type?: "cash-on-delivery";
  metadata?: Record<string, unknown>;
}) => req<T.Shipment>("POST", "/shipments", { body });
export const getShipment = (id: string) => req<T.Shipment>("GET", `/shipments/${id}`);
export const getShipments = (q: Page & { status?: string } = {}) => req<Record<string, unknown>>("GET", "/shipments", { query: q });
export const trackShipment = (id: string) => req<T.Shipment>("GET", `/shipments/track/${id}`);
export const cancelShipment = (shipment_id: string) => req<T.Shipment>("POST", "/shipments/cancel", { body: { shipment_id } });

/** Books the shipment and charges SEH's Terminal wallet. */
export const arrangePickupAndDelivery = (body: {
  rate_id: string;
  shipment_id?: string;
  pickup_option?: T.PickupOption["type"];
  dropoff_id?: string;
  duty_payer?: "account_holder" | "sender" | "receiver";
  purchase_insurance?: boolean;
  cash_to_collect?: number;
}) => req<T.Shipment>("POST", "/shipments/pickup", { body });

// ---------- Rates ----------
export const getRatesForShipment = (q: { shipment_id: string; currency?: T.Currency; cash_on_delivery?: boolean }) =>
  req<T.Rate[]>("GET", "/rates/shipment", { query: q });
export const getRatesForMultiParcel = (body: { shipment_id?: string; parcels?: string[]; pickup_address?: string; delivery_address?: string; currency?: T.Currency }) =>
  req<T.Rate[]>("POST", "/rates/multi/shipment", { body });
export const getRate = (id: string) => req<T.Rate>("GET", `/rates/${id}`);
/** Quick prices from city/state/country and weight. Nothing is created, so these rates can't be booked. */
export const getQuickQuotes = (body: {
  pickup_address: T.QuickAddress;
  delivery_address: T.QuickAddress;
  parcel: Omit<T.ParcelInput, "packaging">;
  currency?: T.Currency;
}) => req<T.Rate[]>("POST", "/rates/shipment/quotes", { body: { ...body, persist_data: false } });

// ---------- Duties ----------
export const estimateDuty = (body: { shipment_id: string; carrier: string; currency?: T.Currency }) =>
  req<T.Duty>("POST", "/duties/calculate", { body });

// ---------- Insurance ----------
export const getInsurancePremium = (parcel: string, insurance_type: "local" | "export", currency: T.Currency = "NGN") =>
  req<T.InsurancePremium>("GET", "/insurance/premium", { query: { parcel, insurance_type, currency } });
export const getInsurancePremiumByValue = (parcel_value: number, insurance_type: "local" | "export", currency: T.Currency = "NGN") =>
  req<T.InsurancePremium>("POST", "/insurance/premium", { body: { parcel_value, insurance_type, currency } });
export const getInsurances = (q: Page & { status?: "confirmed" | "pending" | "failed" } = {}) =>
  req<{ insurances: T.Insurance[] }>("GET", "/insurance", { query: q });
export const purchaseInsurance = (shipment: string) => req<T.Insurance>("POST", "/insurance/purchase", { body: { shipment } });

// ---------- Claims ----------
export const fileClaim = (insurance: string, claim: T.ClaimInput) => req<T.Claim>("POST", "/claims", { body: { insurance, claim } });
export const getClaims = (q: Page & { status?: string } = {}) => req<{ claims: T.Claim[] }>("GET", "/claims", { query: q });
export const getClaim = (id: string) => req<T.Claim>("GET", `/claims/${id}`);

// ---------- Pickups ----------
export const getPickupDates = (q: { address_id: string; carrier_id?: string; shipment_ids?: string[]; count?: number }) =>
  req<T.PickupDates>("GET", "/pickups/dates", { query: q });
export const schedulePickup = (body: { shipment_ids: string[]; pickup_date: string; address_id: string; carrier_id: string; instructions?: string }) =>
  req<T.Pickup>("POST", "/pickups/schedule", { body });
export const getPickup = (id: string) => req<T.Pickup>("GET", `/pickups/${id}`);
export const getPickups = (q: Page = {}) => req<Record<string, unknown>>("GET", "/pickups", { query: q });
export const cancelPickup = (id: string) => req<T.Pickup>("DELETE", `/pickups/${id}`);

// ---------- Carriers ----------
export const getCarriers = (q: Page & { active?: boolean; type?: "domestic" | "regional" | "international" } = {}) =>
  req<{ carriers: T.Carrier[] }>("GET", "/carriers", { query: q });
export const enableCarrier = (id: string, scope: { domestic?: boolean; regional?: boolean; international?: boolean }) =>
  req<T.Carrier>("POST", `/carriers/enable/${id}`, { query: scope });
export const disableCarrier = (id: string, scope: { domestic?: boolean; regional?: boolean; international?: boolean }) =>
  req<T.Carrier>("POST", `/carriers/disable/${id}`, { query: scope });
export const getDropoffLocations = (q: { country: string; carrier: string; state?: string; city?: string }) =>
  req<T.DropoffLocation[]>("GET", "/carriers/locations/drop-off", { query: q });

// ---------- Regulatory documents ----------
export const analyzeRegulatoryDocuments = (shipment_id: string) =>
  req<T.RegulatoryRequest>("POST", "/regulatory-documents/analyze", { body: { shipment_id } });
export const purchaseRegulatoryDocuments = (request_id: string, document_types: string[], shipment_id?: string) =>
  req<T.RegulatoryRequest>("POST", "/regulatory-documents/purchase", { body: { request_id, document_types, shipment_id } });
export const getRegulatoryRequest = (id: string) => req<T.RegulatoryRequest>("GET", `/regulatory-documents/request/${id}`);

// ---------- Reconciliation (weight / price adjustments) ----------
export const getReconciliations = (q: Page & { is_charged?: boolean } = {}) =>
  req<{ reconciliations: T.ReconciliationRecord[] }>("GET", "/reconciliation", { query: q });
export const getReconciliationByShipment = (shipment_id: string) =>
  req<T.ReconciliationRecord>("GET", `/reconciliation/shipment/${shipment_id}`);

// ---------- Rate cards ----------
export const getMyRateCards = () => req<{ cards: T.RateCard[] }>("GET", "/rate-cards/mine");
export const getMyRateCard = (id: string) => req<T.RateCard>("GET", `/rate-cards/mine/${id}`);
export const downloadRateCard = (id: string, format: "pdf" | "excel") =>
  terminalDownload(`/rate-cards/mine/${id}/download/${format}`);

// ---------- Account / wallet ----------
export const getUser = (id: string) => req<Record<string, unknown>>("GET", `/users/${id}`);
export const getWalletBalance = (user_id?: string) => req<T.Wallet>("GET", "/users/wallet-balance", { query: { user_id } });
export const getTransactions = (wallet: string, q: Page = {}) =>
  req<{ transactions: T.Transaction[] }>("GET", "/transactions", { query: { wallet, ...q } });

// ---------- Webhooks ----------
export const getWebhooks = (q: Page = {}) => req<{ webhooks: T.Webhook[] }>("GET", "/webhooks", { query: q });
export const createWebhook = (body: { name: string; url: string; events: T.WebhookEventName[]; live: boolean; active: boolean }) =>
  req<T.Webhook>("POST", "/webhooks", { body });
export const enableWebhook = (id: string) => req<T.Webhook>("POST", `/webhooks/enable/${id}`);
export const disableWebhook = (id: string) => req<T.Webhook>("POST", `/webhooks/disable/${id}`);
export const deleteWebhook = (id: string) => req<unknown>("DELETE", `/webhooks/${id}`);
export const getWebhookDeliveries = (q: { shipment_id?: string; event?: string; page?: number; perPage?: number }) =>
  req<Record<string, unknown>>("GET", "/webhooks/deliveries", { query: q });
export const replayWebhook = (body: { delivery_id?: string; shipment_id?: string; event?: string; webhook_id?: string }) =>
  req<Record<string, unknown>>("POST", "/webhooks/replay", { body });

export const ALL_WEBHOOK_EVENTS: T.WebhookEventName[] = [
  "shipment.created", "shipment.updated", "shipment.in-transit", "shipment.awaiting-clearance",
  "shipment.customs_event", "shipment.pending-cancellation", "shipment.cancelled",
  "shipment.delivered", "shipment.returned",
  "pickup.scheduled", "pickup.booked", "pickup.updated", "pickup.completed", "pickup.cancelled", "pickup.failed",
  "insurance.pending", "insurance.success", "insurance.failed",
  "claim.success", "claim.failed",
  "reconciliation.flagged", "reconciliation.billed", "reconciliation.corrected",
  "regulatory_document.pending", "regulatory_document.uploaded", "regulatory_document.complete",
  "transaction.success", "transaction.failed",
];
