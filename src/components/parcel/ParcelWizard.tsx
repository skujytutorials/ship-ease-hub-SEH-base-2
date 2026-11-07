"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addressSchema, type AddressForm } from "@/lib/outbound/schema";
import type { QuoteView } from "@/lib/outbound/view";
import type { QuotedRate } from "@/lib/outbound/service";
import { formatMoney } from "@/lib/money";
import { AddressFields, emptyAddress, useCountries, type SavedAddress } from "./AddressFields";
import { ParcelEditor, emptyItem, type PackagingOption, type ParcelDraft } from "./ParcelEditor";
import { clearDraft, pushStep, readDraft, replaceStep, useMounted, writeDraft } from "./draft";

const STEPS = ["From", "To", "Contents", "Rate", "Extras", "Pay"] as const;
type Step = 0 | 1 | 2 | 3 | 4 | 5;

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Something went wrong"), { status: res.status });
  return json as T;
}

const days = (r: QuotedRate) => Number(/(\d+)/.exec(r.deliveryTime ?? "")?.[1] ?? 99);
const OPTION_LABEL: Record<string, string> = {
  pickup: "Courier pickup",
  priority_pickup: "Priority pickup (rider today)",
  scheduled_pickup: "Pickup on a date I choose",
  dropoff: "I'll drop it off",
};

type WizardProps = {
  saved?: SavedAddress[];
  signedIn: boolean;
  resumeId?: string;
  basePath: string; // page this wizard lives on, used to come back after sign-in
};

// The saved draft lives in localStorage, so the form renders only in the browser
export function ParcelWizard(props: WizardProps) {
  return useMounted() ? <Wizard {...props} /> : <p className="py-10 text-center text-sm text-navy/60">Loading…</p>;
}

function Wizard({ saved = [], signedIn, resumeId, basePath }: WizardProps) {
  const router = useRouter();
  const countries = useCountries();
  const [draft] = useState(() => readDraft(basePath));
  const [from, setFrom] = useState<AddressForm>(draft?.from ?? emptyAddress("NG"));
  const [to, setTo] = useState<AddressForm>(draft?.to ?? emptyAddress("GB"));
  const [save, setSave] = useState(draft?.save ?? { from: false, to: false });
  const [purpose, setPurpose] = useState<"personal" | "commercial" | "sample">(draft?.purpose ?? "personal");
  const [packaging, setPackaging] = useState<PackagingOption[]>([]);
  const [parcels, setParcels] = useState<ParcelDraft[]>(draft?.parcels ?? []);
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const quoteToLoad = resumeId ?? draft?.quoteId;
  const [loadingQuote, setLoadingQuote] = useState(Boolean(quoteToLoad));
  const [sort, setSort] = useState<"cheapest" | "fastest">("cheapest");
  const [rateId, setRateId] = useState<string | null>(null);
  const [insurance, setInsurance] = useState(false);
  const [option, setOption] = useState<string>("pickup");
  const [dropoffs, setDropoffs] = useState<{ id: string; address: string; city: string }[] | null>(null);
  const [dropoffId, setDropoffId] = useState("");
  const [dates, setDates] = useState<string[] | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Packaging presets from Terminal (boxes started from a quick price have none yet)
  useEffect(() => {
    api<PackagingOption[]>("/api/terminal/packaging")
      .then((p) => {
        setPackaging(p);
        const preset = p[0]?.id ?? "";
        setParcels((cur) => (cur.length ? cur.map((x) => (x.packaging ? x : { ...x, packaging: preset })) : [{ packaging: preset, items: [emptyItem()] }]));
      })
      .catch((e) => setError(e.message));
  }, []);

  // Reload the last quote: coming back from sign-in, or after a refresh
  useEffect(() => {
    if (!quoteToLoad) return;
    api<QuoteView>(`/api/parcel/${quoteToLoad}`)
      .then((q) => {
        setQuote(q);
        setRateId(q.selectedRateId);
        if (resumeId) replaceStep(q.pricing ? 5 : 3);
      })
      .catch(() => undefined) // expired or already paid: the form stays at the details
      .finally(() => setLoadingQuote(false));
  }, [quoteToLoad, resumeId]);

  // Keep the draft up to date as the customer types
  useEffect(() => {
    writeDraft(basePath, { from, to, purpose, parcels, save, quoteId: quote?.id });
  }, [basePath, from, to, purpose, parcels, save, quote]);

  const rate = quote?.rates.find((r) => r.rateId === rateId) ?? null;
  // The step lives in the URL (?step=), so the browser's Back button goes to the previous step.
  // Steps after "Contents" need a quote (and a carrier for "Extras"); fall back if it's missing.
  const wanted = Math.min(5, Math.max(0, Number(useSearchParams().get("step")) || 0));
  const reachable = !quote ? 2 : quote.pricing ? 5 : rate ? 4 : 3;
  const step = Math.min(wanted, reachable) as Step;
  const view = loadingQuote && wanted > reachable ? null : step; // nothing until the saved quote is back
  const international = to.country !== "NG" || Boolean(quote?.international);

  const sortedRates = useMemo(() => {
    const list = [...(quote?.rates ?? [])];
    return sort === "cheapest" ? list.sort((a, b) => a.customerFromMinor - b.customerFromMinor) : list.sort((a, b) => days(a) - days(b));
  }, [quote, sort]);

  const go = (s: Step) => {
    setError(null);
    pushStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function startOver() {
    clearDraft(basePath);
    window.location.href = basePath;
  }

  // Changing the details after prices were fetched makes that quote stale
  const edit =
    <V,>(set: (v: V) => void) =>
    (v: V) => {
      set(v);
      setQuote(null);
      setRateId(null);
    };

  function checkAddress(a: AddressForm, next: Step) {
    const r = addressSchema.safeParse(a);
    if (!r.success) return setError(r.error.issues[0].message);
    go(next);
  }

  async function checkDestination() {
    const r = addressSchema.safeParse(to);
    if (!r.success) return setError(r.error.issues[0].message);
    if (to.country === "NG") return go(2);
    setBusy("Checking the address…");
    try {
      const v = await api<{ is_valid: boolean; suggestion_provided?: boolean; suggested_address?: Partial<AddressForm>; validation_messages: { message: string; severity: string }[] }>(
        "/api/terminal/validate-address",
        to,
      );
      if (v.suggestion_provided && v.suggested_address?.zip && v.suggested_address.zip !== to.zip)
        setTo({ ...to, zip: v.suggested_address.zip });
      const problem = v.validation_messages.find((m) => m.severity === "error");
      if (!v.is_valid && problem) return setError(`${problem.message} Please check the address.`);
      go(2);
    } catch {
      go(2); // validation is a help, never a blocker
    } finally {
      setBusy(null);
    }
  }

  async function getRates() {
    setError(null);
    setBusy("Getting live rates, duties and insurance from carriers…");
    try {
      const q = await api<QuoteView>("/api/parcel/quote", {
        from,
        to,
        purpose,
        parcels: parcels.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i, hs_code: i.hs_code || undefined })) })),
        save,
      });
      if (!q.rates.length) throw new Error("No carrier serves this route for these goods. Try different packaging or contact us.");
      setQuote(q);
      setRateId(null);
      go(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function chooseRate(r: QuotedRate) {
    setRateId(r.rateId);
    setOption(r.pickupOptions[0]?.type ?? "pickup");
    setDropoffs(null);
    setDates(null);
    go(4);
  }

  // Load drop-off points / pickup dates when those options are picked
  useEffect(() => {
    if (!rate || !quote) return;
    if (option === "dropoff" && dropoffs === null && rate.carrierSlug)
      api<typeof dropoffs>(`/api/terminal/dropoffs?carrier=${rate.carrierSlug}&country=NG&state=${encodeURIComponent(from.state || "")}`)
        .then((d) => setDropoffs(d ?? []))
        .catch(() => setDropoffs([]));
    if (option === "scheduled_pickup" && dates === null)
      api<{ dates: string[] }>(`/api/terminal/pickup-dates?shipment=${quote.id}&carrier=${rate.carrierId}`)
        .then((d) => setDates(d.dates))
        .catch(() => setDates([]));
  }, [option, rate, quote, dropoffs, dates, from.state]);

  async function confirmExtras() {
    if (!quote || !rate) return;
    setBusy("Working out your total…");
    setError(null);
    try {
      const q = await api<QuoteView>(`/api/parcel/${quote.id}/select`, {
        rateId: rate.rateId,
        pickupOption: option,
        dropoffId: option === "dropoff" ? dropoffId : undefined,
        pickupDate: option === "scheduled_pickup" ? pickupDate : undefined,
        insurance,
        documents: [],
      });
      setQuote(q);
      go(5);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function pay() {
    if (!quote) return;
    if (!signedIn) {
      router.push(`/signup?next=${encodeURIComponent(`${basePath}?q=${quote.id}`)}`);
      return;
    }
    setBusy("Taking you to secure payment…");
    try {
      const { url } = await api<{ url: string }>(`/api/parcel/${quote.id}/pay`, { acceptTerms: accept });
      clearDraft(basePath); // the shipment page takes over from here
      window.location.href = url;
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) router.push(`/login?next=${encodeURIComponent(`${basePath}?q=${quote.id}`)}`);
      else setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Stepper step={step} onJump={(s) => s < step && s <= 2 && !quote?.pricing && go(s as Step)} />
      <div className="-mt-3 mb-4 flex justify-between text-xs text-navy/50">
        <span>Your progress is saved on this device.</span>
        <button type="button" className="font-semibold text-purple hover:underline" onClick={startOver}>Start again</button>
      </div>

      {error && <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      {view === null && <p className="py-10 text-center text-sm text-navy/60">Loading your quote…</p>}

      {view === 0 && (
        <Section title="Where is it coming from?" subtitle="Pickup address in Nigeria.">
          <AddressFields idPrefix="from" value={from} onChange={edit(setFrom)} countries={countries} lockCountry saved={saved} />
          {signedIn && <SaveToggle checked={save.from} onChange={(v) => setSave({ ...save, from: v })} />}
          <Nav onNext={() => checkAddress(from, 1)} />
        </Section>
      )}

      {view === 1 && (
        <Section title="Where is it going?" subtitle="Any country, or anywhere in Nigeria.">
          <AddressFields idPrefix="to" value={to} onChange={edit(setTo)} countries={countries} saved={saved} />
          {signedIn && <SaveToggle checked={save.to} onChange={(v) => setSave({ ...save, to: v })} />}
          <Nav onBack={() => go(0)} onNext={checkDestination} busy={busy} />
        </Section>
      )}

      {view === 2 && (
        <Section title="What's in it?" subtitle={international ? "Customs need a clear description, value and category for each item." : "Tell us what you're sending."}>
          <div className="mb-4">
            <label className="label" htmlFor="purpose">Reason for sending</label>
            <select id="purpose" className="input" value={purpose} onChange={(e) => edit(setPurpose)(e.target.value as typeof purpose)}>
              <option value="personal">Personal / gift</option>
              <option value="commercial">Sale to a customer</option>
              <option value="sample">Sample</option>
            </select>
          </div>
          <ParcelEditor parcels={parcels} onChange={edit(setParcels)} packaging={packaging} international={international} />
          <Nav onBack={() => go(1)} onNext={getRates} nextLabel="See prices" busy={busy} />
        </Section>
      )}

      {view === 3 && quote && (
        <Section title="Pick a carrier" subtitle={quote.international ? "Prices include estimated import duties at the destination." : undefined}>
          <div className="mb-4 inline-flex rounded-xl bg-mist p-1 text-sm font-semibold">
            {(["cheapest", "fastest"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSort(s)} className={`rounded-lg px-4 py-2 capitalize ${sort === s ? "bg-white text-navy shadow-sm" : "text-navy/60"}`}>
                {s}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {sortedRates.map((r) => (
              <li key={r.rateId}>
                <button type="button" onClick={() => chooseRate(r)} className="card flex w-full items-center gap-4 text-left transition hover:border-purple">
                  {r.carrierLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.carrierLogo} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-mist" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">{r.carrierName}</p>
                    <p className="truncate text-xs text-navy/60">{[r.description, r.deliveryTime].filter(Boolean).join(" · ")}</p>
                    {r.dutyStatus === "estimated" && <p className="text-xs text-navy/60">incl. {formatMoney(r.dutyMinor ?? 0)} duties</p>}
                    {r.dutyStatus === "unavailable" && <p className="text-xs text-danger">Duties couldn&apos;t be estimated; paid by the receiver</p>}
                  </div>
                  <p className="text-right text-lg font-bold text-navy">{formatMoney(r.customerFromMinor)}</p>
                </button>
              </li>
            ))}
          </ul>
          <Nav onBack={() => go(2)} />
        </Section>
      )}

      {view === 4 && quote && rate && (
        <Section title="Pickup and protection" subtitle={`${rate.carrierName} · ${rate.deliveryTime ?? ""}`}>
          <fieldset className="space-y-2">
            <legend className="label">How should the courier get it?</legend>
            {rate.pickupOptions.map((o) => (
              <label key={o.type} className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${option === o.type ? "border-purple bg-purple/5" : "border-silver"}`}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="pickup" checked={option === o.type} onChange={() => setOption(o.type)} />
                  <span className="text-sm font-semibold text-navy">{OPTION_LABEL[o.type] ?? o.type}</span>
                </span>
                {o.type === "priority_pickup" && rate.priorityPickupMinor ? <span className="text-sm text-navy/70">+{formatMoney(rate.priorityPickupMinor)}</span> : null}
              </label>
            ))}
          </fieldset>

          {option === "dropoff" && (
            <div className="mt-4">
              <label className="label" htmlFor="dropoff">Drop-off point</label>
              {dropoffs === null ? (
                <p className="text-sm text-navy/60">Loading drop-off points…</p>
              ) : dropoffs.length ? (
                <select id="dropoff" className="input" value={dropoffId} onChange={(e) => setDropoffId(e.target.value)}>
                  <option value="">Choose…</option>
                  {dropoffs.map((d) => (
                    <option key={d.id} value={d.id}>{d.city}: {d.address}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-danger">No drop-off points listed near you for this carrier. Choose pickup instead.</p>
              )}
            </div>
          )}

          {option === "scheduled_pickup" && (
            <div className="mt-4">
              <label className="label" htmlFor="pdate">Pickup date</label>
              {dates === null ? (
                <p className="text-sm text-navy/60">Loading available dates…</p>
              ) : (
                <select id="pdate" className="input" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}>
                  <option value="">Choose…</option>
                  {dates.map((d) => (
                    <option key={d} value={d}>{new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-silver p-4">
            <input type="checkbox" className="mt-1" checked={insurance || rate.insuranceIncluded} disabled={rate.insuranceIncluded} onChange={(e) => setInsurance(e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-navy">
                {rate.insuranceIncluded ? "Insurance included with this carrier" : `Insure it for ${formatMoney(quote.insurancePremiumMinor)}`}
              </span>
              <span className="text-xs text-navy/60">Covers loss or damage in transit up to the declared value. You can file a claim from your shipment page.</span>
            </span>
          </label>

          {quote.international && (
            <p className="mt-6 rounded-2xl bg-mist px-4 py-3 text-xs text-navy/65">
              If the destination needs extra customs documents for your goods (for example an FDA notice for food going to the USA), we&apos;ll tell you after booking and can prepare them for you.
            </p>
          )}

          <Nav onBack={() => go(3)} onNext={confirmExtras} nextLabel="Review" busy={busy} />
        </Section>
      )}

      {view === 5 && quote?.pricing && (
        <Section title="Review and pay" subtitle={`Quote ${quote.code}`}>
          <div className="card space-y-2">
            {quote.pricing.map((l) => (
              <div key={l.key} className="flex justify-between text-sm">
                <span className="text-navy/70">{l.label}</span>
                <span className="font-medium text-navy">{formatMoney(l.minor)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-silver pt-3 text-lg font-bold text-navy">
              <span>Total</span>
              <span>{formatMoney(quote.totalMinor ?? 0)}</span>
            </div>
          </div>
          {signedIn && (
            <label className="mt-4 flex items-start gap-3 text-sm text-navy/80">
              <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                The contents match my description, contain no prohibited items, and I accept the{" "}
                <a href="/terms" target="_blank" className="font-semibold text-purple">terms</a>. If the carrier finds the parcel is heavier, I&apos;ll pay the difference.
              </span>
            </label>
          )}
          <button type="button" className="btn-primary mt-6 w-full" onClick={pay} disabled={Boolean(busy) || (signedIn && !accept)}>
            {busy ?? (signedIn ? `Pay ${formatMoney(quote.totalMinor ?? 0)}` : "Create an account to pay")}
          </button>
          <button type="button" className="btn-ghost mt-3 w-full" onClick={() => go(3)} disabled={Boolean(busy)}>
            Change carrier or extras
          </button>
        </Section>
      )}
    </div>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="mb-6 flex gap-1.5" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex-1">
          <button type="button" onClick={() => onJump(i)} className="w-full text-left" aria-current={i === step ? "step" : undefined}>
            <div className={`bar-cut h-1.5 ${i < step ? "bg-purple" : i === step ? "bg-cyan" : "bg-silver/60"}`} />
            <span className={`mt-1 hidden text-[11px] font-semibold uppercase tracking-wide sm:block ${i <= step ? "text-navy" : "text-navy/40"}`}>{label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-light text-navy">{title}</h2>
      {subtitle && <p className="mb-5 mt-1 text-sm text-navy/60">{subtitle}</p>}
      {!subtitle && <div className="mb-5" />}
      {children}
    </section>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continue", busy }: { onBack?: () => void; onNext?: () => void; nextLabel?: string; busy?: string | null }) {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {busy && <p className="text-center text-sm text-navy/60">{busy}</p>}
      <div className="flex gap-3">
        {onBack && <button type="button" className="btn-ghost flex-1" onClick={onBack} disabled={Boolean(busy)}>Back</button>}
        {onNext && <button type="button" className="btn-primary flex-[2]" onClick={onNext} disabled={Boolean(busy)}>{nextLabel}</button>}
      </div>
    </div>
  );
}

function SaveToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-4 flex items-center gap-2 text-sm text-navy/80">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> Save this address for next time
    </label>
  );
}
