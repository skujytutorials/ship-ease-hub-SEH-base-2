"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { EstimateRate } from "@/lib/outbound/estimate";
import { formatMoney } from "@/lib/money";
import { useCities, useCountries, useStates } from "./AddressFields";
import { ParcelWizard } from "./ParcelWizard";
import { prefillDraft, pushStep, useMounted } from "./draft";

type Form = { fromState: string; fromCity: string; toCountry: string; toState: string; toCity: string; weight: string };
type Result = { international: boolean; rates: EstimateRate[] };

const STORE = "seh:quick-quote:v1";
const blank: Form = { fromState: "Lagos", fromCity: "", toCountry: "GB", toState: "", toCity: "", weight: "1" };

function load(): { form: Form; result: Result | null } {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
    if (s?.form) return { form: { ...blank, ...s.form }, result: s.result ?? null };
  } catch {}
  return { form: blank, result: null };
}

/**
 * The /quote page: a quick price from where, to where and weight. "Book now" opens the
 * full form (?step=) with those details filled in. Coming back from sign-in (?q=) goes
 * straight to the full form.
 */
export function QuoteFlow({ signedIn, resumeId }: { signedIn: boolean; resumeId?: string }) {
  const params = useSearchParams();
  const mounted = useMounted();
  const booking = Boolean(resumeId) || params.has("step");
  if (!mounted) return <p className="py-10 text-center text-sm text-navy/60">Loading…</p>;
  return booking ? <ParcelWizard signedIn={signedIn} resumeId={resumeId} basePath="/quote" /> : <QuickQuote />;
}

function QuickQuote() {
  const [initial] = useState(load);
  const [form, setForm] = useState<Form>(initial.form);
  const [result, setResult] = useState<Result | null>(initial.result);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countries = useCountries();
  const fromStates = useStates("NG");
  const toStates = useStates(form.toCountry);
  const fromCities = useCities("NG", fromStates.find((s) => s.name === form.fromState)?.code);
  const toCities = useCities(form.toCountry, toStates.find((s) => s.name === form.toState)?.code);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ form, result }));
    } catch {}
  }, [form, result]);

  // Any change makes the shown prices out of date
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setResult(null);
  };

  async function getPrices(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/parcel/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: { country: "NG", state: form.fromState, city: form.fromCity },
          to: { country: form.toCountry, state: form.toState, city: form.toCity },
          weightKg: form.weight,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't get prices. Please try again.");
      if (!json.rates?.length) throw new Error("No carrier serves this route at the moment. Contact us and we'll help.");
      setResult(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function book() {
    prefillDraft("/quote", {
      from: { state: form.fromState, city: form.fromCity },
      to: { country: form.toCountry, state: form.toState, city: form.toCity },
      weightKg: Number(form.weight) || 0.5,
    });
    pushStep(0);
    window.scrollTo({ top: 0 });
  }

  const cheapest = result?.rates[0];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h2 className="text-2xl font-light text-navy">Get a quick price</h2>
      <p className="mb-6 mt-1 text-sm text-navy/60">Where it&apos;s going and how heavy it is. You&apos;ll add the full details when you book.</p>

      <form onSubmit={getPrices} className="space-y-6">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy">From (Nigeria)</legend>
          <Select id="qq-fs" label="State" value={form.fromState} onChange={(v) => set({ fromState: v, fromCity: "" })} options={fromStates.map((s) => s.name)} />
          <CityInput id="qq-fc" value={form.fromCity} onChange={(v) => set({ fromCity: v })} cities={fromCities} />
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold text-navy">To</legend>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="qq-tc">Country</label>
            <select id="qq-tc" className="input" value={form.toCountry} onChange={(e) => set({ toCountry: e.target.value, toState: "", toCity: "" })}>
              {countries.length === 0 && <option value={form.toCountry}>{form.toCountry}</option>}
              {countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
          {toStates.length > 0 ? (
            <Select id="qq-ts" label="State / region" value={form.toState} onChange={(v) => set({ toState: v, toCity: "" })} options={toStates.map((s) => s.name)} />
          ) : (
            <div>
              <label className="label" htmlFor="qq-ts">State / region</label>
              <input id="qq-ts" className="input" value={form.toState} onChange={(e) => set({ toState: e.target.value })} required />
            </div>
          )}
          <CityInput id="qq-tci" value={form.toCity} onChange={(v) => set({ toCity: v })} cities={toCities} />
        </fieldset>

        <div className="max-w-[12rem]">
          <label className="label" htmlFor="qq-w">Weight (kg)</label>
          <input id="qq-w" className="input" type="number" inputMode="decimal" min={0.1} max={70} step={0.1} value={form.weight} onChange={(e) => set({ weight: e.target.value })} required />
        </div>
        <p className="-mt-4 text-xs text-navy/50">Not sure? A pair of shoes is about 1.5 kg, a laptop about 2.5 kg.</p>

        {error && <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

        {!result && (
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Getting prices from carriers…" : "See prices"}</button>
        )}
      </form>

      {result && cheapest && (
        <section className="mt-8" aria-live="polite">
          <p className="text-sm text-navy/60">From</p>
          <p className="font-display text-4xl font-medium text-navy">{formatMoney(cheapest.priceMinor)}</p>
          <p className="mt-1 text-sm text-navy/60">
            {result.international
              ? "Shipping only. Any import duties at the destination are worked out when you book."
              : "Your exact price is confirmed when you add the full details."}
          </p>

          <ul className="mt-5 space-y-2">
            {result.rates.map((r) => (
              <li key={`${r.carrierName}-${r.priceMinor}`} className="flex items-center gap-4 rounded-2xl border border-silver/70 p-3">
                {r.carrierLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.carrierLogo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-mist" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy">{r.carrierName}</p>
                  {r.deliveryTime && <p className="text-xs text-navy/60">{r.deliveryTime}</p>}
                </div>
                <p className="font-bold text-navy">{formatMoney(r.priceMinor)}</p>
              </li>
            ))}
          </ul>

          <button type="button" className="btn-primary mt-6 w-full" onClick={book}>Book now</button>
          <p className="mt-3 text-center text-xs text-navy/50">You&apos;ll add names, addresses and what&apos;s inside, then choose your carrier.</p>
        </section>
      )}
    </div>
  );
}

function Select({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Choose…</option>
        {options.length === 0 && value && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function CityInput({ id, value, onChange, cities }: { id: string; value: string; onChange: (v: string) => void; cities: string[] }) {
  return (
    <div>
      <label className="label" htmlFor={id}>City</label>
      <input id={id} className="input" list={`${id}-list`} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" required />
      <datalist id={`${id}-list`}>
        {cities.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}
