"use client";

import { useSyncExternalStore } from "react";
import type { AddressForm } from "@/lib/outbound/schema";
import { emptyAddress } from "./AddressFields";
import { emptyItem, type ParcelDraft } from "./ParcelEditor";

/**
 * Parcel form progress kept in this browser, so going back, refreshing or leaving
 * the page doesn't lose what was typed. One draft per page (guest /quote vs app).
 */

export type WizardDraft = {
  from: AddressForm;
  to: AddressForm;
  purpose: "personal" | "commercial" | "sample";
  parcels: ParcelDraft[];
  save: { from: boolean; to: boolean };
  quoteId?: string;
};

const key = (basePath: string) => `seh:parcel-draft:v1:${basePath}`;

export function readDraft(basePath: string): WizardDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key(basePath)) ?? "null");
    return d && d.from && d.to && Array.isArray(d.parcels) ? (d as WizardDraft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(basePath: string, d: WizardDraft) {
  try {
    localStorage.setItem(key(basePath), JSON.stringify(d));
  } catch {
    // private mode or storage full: the form still works, it just isn't saved
  }
}

export function clearDraft(basePath: string) {
  try {
    localStorage.removeItem(key(basePath));
  } catch {}
}

/** Starts (or updates) a draft from the quick price check. */
export function prefillDraft(
  basePath: string,
  p: { from: { state: string; city: string }; to: { country: string; state: string; city: string }; weightKg: number },
) {
  const cur = readDraft(basePath);
  const sameTo = cur?.to.country === p.to.country;
  const parcels = cur?.parcels.length
    ? cur.parcels.map((x, i) => (i === 0 ? { ...x, items: x.items.map((it, j) => (j === 0 ? { ...it, weight: p.weightKg } : it)) } : x))
    : [{ packaging: "", items: [{ ...emptyItem(), weight: p.weightKg }] }];
  writeDraft(basePath, {
    purpose: cur?.purpose ?? "personal",
    save: cur?.save ?? { from: false, to: false },
    from: { ...(cur?.from ?? emptyAddress("NG")), country: "NG", state: p.from.state, city: p.from.city },
    to: { ...(sameTo ? cur!.to : emptyAddress(p.to.country)), country: p.to.country, state: p.to.state, city: p.to.city },
    parcels,
  });
}

const noop = () => () => {};
/** False on the server and during hydration, true after: gate anything read from localStorage. */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/** Moves the form to a step and adds a browser history entry, so Back returns to the previous step. */
export function pushStep(step: number) {
  const p = new URLSearchParams(window.location.search);
  p.set("step", String(step));
  window.history.pushState(null, "", `?${p}`);
}

export function replaceStep(step: number) {
  const p = new URLSearchParams(window.location.search);
  p.set("step", String(step));
  window.history.replaceState(null, "", `?${p}`);
}
