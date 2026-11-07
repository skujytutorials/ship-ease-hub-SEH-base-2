"use client";

import { useEffect, useState } from "react";
import type { AddressForm } from "@/lib/outbound/schema";

export type Country = { code: string; name: string; flag: string; phonecode: string };
export type SavedAddress = AddressForm & { id: string; label?: string | null };

export const emptyAddress = (country = "NG"): AddressForm => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  country,
  zip: "",
});

const cache = new Map<string, unknown>();
async function getJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url) as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request failed");
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([]);
  useEffect(() => {
    getJson<Country[]>("/api/terminal/countries").then(setCountries).catch(() => setCountries([]));
  }, []);
  return countries;
}

export function useStates(country: string) {
  const [states, setStates] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    if (!country) return;
    getJson<{ code: string; name: string }[]>(`/api/terminal/states?country=${country}`)
      .then(setStates)
      .catch(() => setStates([]));
  }, [country]);
  return states;
}

export function useCities(country: string, stateCode?: string) {
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => {
    if (!country || !stateCode) return;
    getJson<string[]>(`/api/terminal/cities?country=${country}&state=${stateCode}`)
      .then(setCities)
      .catch(() => setCities([]));
  }, [country, stateCode]);
  return cities;
}

export function AddressFields({
  value,
  onChange,
  countries,
  lockCountry,
  saved = [],
  idPrefix,
}: {
  value: AddressForm;
  onChange: (a: AddressForm) => void;
  countries: Country[];
  lockCountry?: boolean;
  saved?: SavedAddress[];
  idPrefix: string;
}) {
  const states = useStates(value.country);
  const cities = useCities(value.country, states.find((s) => s.name === value.state)?.code);

  const set = (patch: Partial<AddressForm>) => onChange({ ...value, ...patch });
  const id = (f: string) => `${idPrefix}-${f}`;
  const usable = saved.filter((s) => !lockCountry || s.country === value.country);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {usable.length > 0 && (
        <div className="sm:col-span-2">
          <label className="label" htmlFor={id("saved")}>Saved addresses</label>
          <select
            id={id("saved")}
            className="input"
            defaultValue=""
            onChange={(e) => {
              const s = usable.find((a) => a.id === e.target.value);
              if (s) onChange({ ...emptyAddress(), ...s, line2: s.line2 ?? "" });
            }}
          >
            <option value="">Choose a saved address…</option>
            {usable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label || `${s.first_name} ${s.last_name}`} – {s.line1}, {s.city}
              </option>
            ))}
          </select>
        </div>
      )}
      <Field label="First name" id={id("fn")} value={value.first_name} onChange={(v) => set({ first_name: v })} autoComplete="given-name" />
      <Field label="Last name" id={id("ln")} value={value.last_name} onChange={(v) => set({ last_name: v })} autoComplete="family-name" />
      <Field label="Email" id={id("em")} type="email" value={value.email} onChange={(v) => set({ email: v })} autoComplete="email" />
      <Field label="Phone (with country code)" id={id("ph")} type="tel" value={value.phone} onChange={(v) => set({ phone: v })} autoComplete="tel" />
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id("country")}>Country</label>
        <select
          id={id("country")}
          className="input"
          value={value.country}
          disabled={lockCountry}
          onChange={(e) => set({ country: e.target.value, state: "", city: "" })}
        >
          {countries.length === 0 && <option value={value.country}>{value.country}</option>}
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Field label="Street address" id={id("l1")} value={value.line1} onChange={(v) => set({ line1: v })} autoComplete="address-line1" />
      </div>
      <div className="sm:col-span-2">
        <Field label="Apartment, landmark (optional)" id={id("l2")} value={value.line2 ?? ""} onChange={(v) => set({ line2: v })} autoComplete="address-line2" />
      </div>
      <div>
        <label className="label" htmlFor={id("state")}>State / region</label>
        {states.length > 0 ? (
          <select id={id("state")} className="input" value={value.state} onChange={(e) => set({ state: e.target.value, city: "" })}>
            <option value="">Choose…</option>
            {states.map((s) => (
              <option key={s.code} value={s.name}>{s.name}</option>
            ))}
          </select>
        ) : (
          <input id={id("state")} className="input" value={value.state} onChange={(e) => set({ state: e.target.value })} />
        )}
      </div>
      <div>
        <label className="label" htmlFor={id("city")}>City</label>
        <input id={id("city")} className="input" list={id("cities")} value={value.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" />
        <datalist id={id("cities")}>
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <Field label="Postcode / ZIP" id={id("zip")} value={value.zip} onChange={(v) => set({ zip: v })} autoComplete="postal-code" />
    </div>
  );
}

function Field(props: { label: string; id: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label className="label" htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className="input"
        type={props.type ?? "text"}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}
