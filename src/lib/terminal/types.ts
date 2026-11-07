// Shapes returned by the Terminal Africa API. Only fields we use are typed;
// everything else is kept via the index signature.

export type Currency =
  | "AED" | "AUD" | "CAD" | "CNY" | "EUR" | "GBP" | "GHS"
  | "HKD" | "KES" | "NGN" | "TZS" | "UGX" | "USD" | "ZAR";

type Extra = { [key: string]: unknown };

export type AddressInput = {
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string; // ISO-2
  zip: string;
  is_residential?: boolean;
  metadata?: Record<string, unknown>;
};

export type Address = AddressInput & Extra & { address_id: string };

export type AddressValidation = {
  is_valid: boolean;
  validation_results: Record<string, boolean>;
  validation_messages: { code: string; field: string; severity: string; message: string }[];
  suggestion_provided: boolean;
  suggested_address?: Partial<AddressInput>;
};

export type Country = { isoCode: string; name: string; flag: string; phonecode: string; currency: string };
export type State = { isoCode: string; name: string; countryCode: string };
export type City = { name: string; countryCode: string; stateCode: string };

export type PackagingInput = {
  name: string;
  type: "box" | "envelope" | "soft-packaging";
  length: number;
  width: number;
  height: number;
  size_unit: "cm";
  weight: number;
  weight_unit: "kg";
};
export type Packaging = PackagingInput & Extra & { packaging_id: string; default?: boolean };

export type ParcelItem = {
  name: string;
  description: string;
  type: "document" | "parcel";
  currency: Currency;
  value: number;
  quantity: number;
  weight: number; // kg
  hs_code?: string;
};

export type ParcelInput = {
  packaging: string;
  weight_unit: "kg";
  items: ParcelItem[];
  description?: string;
  metadata?: Record<string, unknown>;
  proof_of_payments?: string[];
  rec_docs?: string[];
};
export type Parcel = ParcelInput & Extra & { parcel_id: string; total_weight?: number; totalWeight?: number };
export type QuickAddress = { city: string; state: string; country: string; zip?: string };

export type ShipmentPurpose = "commercial" | "personal" | "sample" | "return-after-repair" | "return-for-repair";

export type ShipmentEvent = { status: string; description: string; location?: string; created_at: string };

export type ShipmentExtras = {
  tracking_number?: string;
  tracking_url?: string;
  carrier_tracking_url?: string;
  shipping_label_url?: string;
  commercial_invoice_url?: string;
  proof_of_delivery?: { url: string; type?: string; signed_by?: string };
  [key: string]: unknown;
};

export type Shipment = Extra & {
  shipment_id: string;
  status: string;
  events?: ShipmentEvent[];
  extras?: ShipmentExtras;
  rate?: string;
  carrier?: unknown;
  metadata?: Record<string, unknown>;
};

export type PickupOption = {
  type: "pickup" | "priority_pickup" | "scheduled_pickup" | "dropoff";
  amount?: number | null;
  currency?: string;
  [key: string]: unknown;
};

export type Rate = Extra & {
  rate_id: string;
  amount: number;
  currency: Currency;
  carrier_id: string;
  carrier_name: string;
  carrier_slug?: string;
  carrier_logo?: string;
  carrier_rate_description?: string;
  delivery_time?: string;
  delivery_eta?: string;
  pickup_time?: string;
  includes_insurance?: boolean;
  includes_duties?: boolean;
  dropoff_required?: boolean;
  insurance_fee?: number;
  insurance_coverage?: number;
  pickup_options?: PickupOption[];
  priority_pickup_available?: boolean;
  priority_pickup_fee?: number;
  metadata?: Record<string, unknown>;
};

export type Duty = Extra & {
  amount: number;
  currency: Currency;
  duty_currency?: string;
  breakdown?: Record<string, number>;
  duty_fee_id?: string;
  applied?: boolean;
};

export type InsurancePremium = { premium: number; currency: Currency };
export type Insurance = Extra & { insurance_id: string; amount: number; currency: string; status: string; shipment: string };

export type Carrier = Extra & {
  carrier_id: string;
  name: string;
  slug: string;
  logo?: string;
  active: boolean;
  domestic: boolean;
  regional: boolean;
  international: boolean;
  available_countries?: string[];
  requires_invoice?: boolean;
  requires_waybill?: boolean;
};

export type DropoffLocation = Extra & {
  dropoff_id?: string; // what the API actually returns
  drop_off_location_id?: string; // what the docs show
  address: string;
  carrier: string;
  city: string;
  state: string;
  country: string;
  phone?: string;
};

export type PickupDates = { dates: string[]; ready_time: string; timezone: string };
export type Pickup = Extra & { pickup_id: string; type: string; status: string; shipments: string[]; next_action?: string; version?: number };

export type HsCode = Extra & { hs_code?: string; code?: string; description?: string; category?: string; chapter?: string };

export type ClaimInput = {
  description: string;
  reason: "lost-in-transit" | "damage";
  signature?: string; // base64 image
  witnesses?: [string, string][];
};
export type Claim = Extra & { claim_id: string; insurance: string; reason: string; status: string };

export type ReconciliationRecord = Extra & {
  reconcilliation_id: string; // (sic) spelled this way by Terminal
  shipment_id: string;
  charge_type: string;
  total_old_shipment_cost: number;
  total_new_shipment_cost: number;
  total_exception_charge: number;
  is_charged: boolean;
  voided: boolean;
};

export type RegulatoryDocument = { type: string; name: string; amount: number; currency: string; free?: boolean; automated?: boolean; logo?: string };
export type RegulatoryRequest = Extra & {
  request_id: string;
  status: string;
  available_documents: RegulatoryDocument[];
  purchased_documents?: (RegulatoryDocument & { document_url?: string; document_id?: string; status?: string })[];
  validation?: { ok: boolean; items_missing_hs_codes: unknown[] };
};

export type Wallet = { amount: number; currency: string; active: boolean; name?: string; [key: string]: unknown };
export type Transaction = Extra & { transactionId: string; amount: number; currency: string; description: string; flow: "in" | "out"; status: string; created_at: string };

export type RateCardDirection = { service_direction: "local" | "export" | "import"; rate_card_id: string; name: string; currency: string; [key: string]: unknown };
export type RateCard = Extra & { carrier?: string; carrier_name?: string; pricing_grade?: string; directions: RateCardDirection[] };

export type WebhookEventName =
  | "address.created" | "address.updated" | "address.deleted"
  | "claim.success" | "claim.failed"
  | "insurance.pending" | "insurance.success" | "insurance.failed"
  | "packaging.created" | "packaging.updated"
  | "pickup.scheduled" | "pickup.booked" | "pickup.updated" | "pickup.completed" | "pickup.cancelled" | "pickup.failed"
  | "reconciliation.flagged" | "reconciliation.billed" | "reconciliation.corrected"
  | "regulatory_document.pending" | "regulatory_document.uploaded" | "regulatory_document.complete"
  | "shipment.created" | "shipment.updated" | "shipment.in-transit" | "shipment.awaiting-clearance"
  | "shipment.customs_event" | "shipment.pending-cancellation" | "shipment.cancelled"
  | "shipment.delivered" | "shipment.returned"
  | "transaction.success" | "transaction.failed";

export type Webhook = Extra & { webhook_id: string; name: string; url: string; active: boolean; live: boolean; events?: string[]; event?: string[] };

export type Paginated<K extends string, T> = { [P in K]: T[] } & { pagination?: Record<string, unknown> };
