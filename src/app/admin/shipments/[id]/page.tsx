import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { STATUS } from "@/lib/status";
import { getWebhookDeliveries } from "@/lib/terminal/api";
import type { PriceLine } from "@/lib/outbound/pricing";
import { dutyPaidNow, type SelectedRate } from "@/lib/outbound/service";
import { StatusChip } from "@/components/Status";
import { EventList } from "@/components/EventList";
import { ActionButton } from "../../ActionButton";
import { adminCancelAndRefund, adminRefresh, replayShipmentWebhook, retryBooking } from "../../actions";
import { PageTitle, safe } from "../../ui";

export default async function AdminShipment({ params }: PageProps<"/admin/shipments/[id]">) {
  const { id } = await params;
  const s = await db.shipment.findUnique({
    where: { id },
    include: {
      user: true,
      events: { orderBy: { occurredAt: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      reconciliations: true,
      claims: true,
    },
  });
  if (!s) notFound();

  const rate = s.selectedRate as SelectedRate | null;
  const pricing = (s.pricing as PriceLine[] | null) ?? [];
  const deliveries = s.terminalShipmentId && s.status !== STATUS.DRAFT ? await safe(() => getWebhookDeliveries({ shipment_id: s.terminalShipmentId!, perPage: 20 })) : {};
  const deliveryEvents = ((deliveries.data as { events?: { webhook_event_id: string; event: string; created_at: string; deliveries?: { status: string; http_status?: number }[] }[] } | undefined)?.events) ?? [];
  const terminalCost = rate ? rate.shippingMinor + (dutyPaidNow(rate) ? (rate.dutyMinor ?? 0) : 0) : 0;

  return (
    <div className="space-y-4">
      <Link href="/admin/shipments" className="text-sm font-semibold text-purple">← Shipments</Link>
      <PageTitle title={s.code} subtitle={`Terminal ${s.terminalShipmentId ?? "–"} · ${s.user?.email ?? "guest"}`} />

      <div className="card flex flex-wrap items-center gap-3">
        <StatusChip status={s.status} />
        {s.bookingError && <span className="text-sm text-danger">{s.bookingError}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {s.status === STATUS.BOOKING_FAILED && (
            <ActionButton className="btn-primary" action={retryBooking.bind(null, s.id)}>Retry booking</ActionButton>
          )}
          {s.terminalShipmentId && s.status !== STATUS.DRAFT && <ActionButton action={adminRefresh.bind(null, s.id)}>Refresh from Terminal</ActionButton>}
          {[STATUS.BOOKED, STATUS.PICKUP_SCHEDULED, STATUS.BOOKING_FAILED, STATUS.PAID].includes(s.status as never) && (
            <ActionButton className="btn-danger" confirmText="Cancel on Terminal and refund the customer?" action={adminCancelAndRefund.bind(null, s.id)}>
              Cancel &amp; refund
            </ActionButton>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-bold text-navy">Money</h2>
          {pricing.map((l) => (
            <div key={l.key} className="flex justify-between"><span className="text-navy/70">{l.label}</span><span>{formatMoney(l.minor)}</span></div>
          ))}
          <div className="flex justify-between border-t border-silver pt-2 font-bold"><span>Customer paid</span><span>{formatMoney(s.totalMinor ?? 0)}</span></div>
          {rate && (
            <div className="flex justify-between text-navy/70"><span>Terminal cost (rate + duty)</span><span>{formatMoney(terminalCost)}</span></div>
          )}
          <h3 className="pt-3 font-semibold text-navy">Payments</h3>
          {s.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs">
              <span className="font-mono">{p.reference} · {p.provider} · {p.purpose}</span>
              <span>{formatMoney(p.amountMinor, p.currency)} · {p.status}</span>
            </div>
          ))}
        </div>

        <div className="card space-y-2 text-sm">
          <h2 className="font-bold text-navy">Booking</h2>
          <p>Carrier: <b>{s.carrierName ?? "–"}</b> {rate?.carrierSlug && <span className="text-navy/60">({rate.carrierSlug})</span>}</p>
          <p>Collection: <b>{s.pickupOption ?? "–"}</b> {s.pickupDate} {s.pickupId && <span className="font-mono text-xs">{s.pickupId}</span>}</p>
          <p>Tracking: <b>{s.trackingNumber ?? "–"}</b></p>
          <p>Insurance: <b>{s.withInsurance ? s.insuranceId ?? "pending" : "no"}</b></p>
          <div className="flex flex-wrap gap-2 pt-2">
            {s.labelUrl && <a className="btn-ghost" href={`/api/parcel/${s.id}/label`} target="_blank" rel="noreferrer">Label</a>}
            {s.invoiceUrl && <a className="btn-ghost" href={s.invoiceUrl} target="_blank" rel="noreferrer">Invoice</a>}
            {s.trackingUrl && <a className="btn-ghost" href={s.trackingUrl} target="_blank" rel="noreferrer">Terminal tracking</a>}
          </div>
          {s.reconciliations.map((r) => (
            <p key={r.id} className="rounded-lg bg-gold/15 p-2">
              Weight check {r.terminalId}: +{formatMoney(r.extraChargeMinor)} ({r.chargeType}) · {r.isCharged ? "billed" : "flagged"} · customer {r.customerPaid ? "paid" : "not paid"}
            </p>
          ))}
          {s.claims.map((c) => (
            <p key={c.id} className="rounded-lg bg-mist p-2">Claim {c.terminalId}: {c.reason} · {c.status}</p>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-bold text-navy">Timeline</h2>
          <EventList events={s.events} />
        </div>
        <div className="card text-sm">
          <h2 className="mb-3 font-bold text-navy">Terminal webhook deliveries</h2>
          {deliveries.error && <p className="mb-3 text-navy/60">Not available yet. Terminal lists deliveries once a webhook is registered (Admin → Webhooks), which needs the app online.</p>}
          {deliveryEvents.length === 0 ? (
            <p className="text-navy/60">None yet.</p>
          ) : (
            <ul className="space-y-2">
              {deliveryEvents.map((e) => (
                <li key={e.webhook_event_id} className="flex items-center justify-between gap-2">
                  <span>
                    <b>{e.event}</b> <span className="text-xs text-navy/60">{new Date(e.created_at).toLocaleString("en-GB")}</span>
                    <span className="block text-xs text-navy/60">{e.deliveries?.map((d) => `${d.status} ${d.http_status ?? ""}`).join(", ")}</span>
                  </span>
                  <ActionButton action={replayShipmentWebhook.bind(null, s.id, e.event)}>Replay</ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
