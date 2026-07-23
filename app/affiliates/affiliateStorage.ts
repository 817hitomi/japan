"use client";

import { readApiError } from "../../lib/apiErrors";
import { AffiliateRecord, normalizeAffiliate, normalizeAffiliates, seedAffiliates } from "./affiliateTypes";

const affiliateStorageKey = "japannote-admin-affiliates";

export type AffiliatesReadResult = {
  source: "database" | "local";
  affiliates: AffiliateRecord[];
  error?: string;
};

export function readStoredAffiliates(includeDrafts = true) {
  if (typeof window === "undefined") {
    return normalizeAffiliates(seedAffiliates, includeDrafts);
  }

  const raw = window.localStorage.getItem(affiliateStorageKey);
  if (!raw) {
    window.localStorage.setItem(affiliateStorageKey, JSON.stringify(seedAffiliates));
    return normalizeAffiliates(seedAffiliates, includeDrafts);
  }

  try {
    return normalizeAffiliates(JSON.parse(raw), includeDrafts);
  } catch {
    return normalizeAffiliates(seedAffiliates, includeDrafts);
  }
}

export function writeStoredAffiliates(affiliates: AffiliateRecord[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(affiliateStorageKey, JSON.stringify(normalizeAffiliates(affiliates)));
  }
}

async function parseAffiliatesResponse(response: Response) {
  if (!response.ok) {
    throw new Error(await readApiError(response, `Affiliates API failed: ${response.status}`));
  }

  const payload = (await response.json()) as { affiliates?: AffiliateRecord[] };
  return normalizeAffiliates(payload.affiliates);
}

export async function fetchAffiliates(status: "published" | "all" = "all") {
  const response = await fetch(`/api/affiliates?status=${status}`, { cache: "no-store" });
  return parseAffiliatesResponse(response);
}

export async function fetchAffiliate(id: number) {
  const response = await fetch(`/api/affiliates/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readApiError(response, `Affiliate API failed: ${response.status}`));
  }

  const payload = (await response.json()) as { affiliate?: AffiliateRecord };
  if (!payload.affiliate) {
    throw new Error("Affiliate response missing affiliate");
  }
  return normalizeAffiliate(payload.affiliate);
}

export async function readAffiliatesWithSource(status: "published" | "all" = "all"): Promise<AffiliatesReadResult> {
  try {
    const affiliates = await fetchAffiliates(status);
    writeStoredAffiliates(affiliates);
    return { source: "database", affiliates };
  } catch (error) {
    return {
      source: "local",
      affiliates: readStoredAffiliates(status !== "published"),
      error: error instanceof Error ? error.message : "Affiliates API failed"
    };
  }
}

export async function saveAffiliate(affiliate: AffiliateRecord, mode: "create" | "update") {
  const normalized = normalizeAffiliate(affiliate);
  const response = await fetch(mode === "update" ? `/api/affiliates/${normalized.id}` : "/api/affiliates", {
    method: mode === "update" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized)
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Save affiliate failed: ${response.status}`));
  }

  const payload = (await response.json()) as { affiliate?: AffiliateRecord };
  if (!payload.affiliate) {
    throw new Error("Save affiliate response missing affiliate");
  }

  return normalizeAffiliate(payload.affiliate);
}

export async function deleteAffiliates(ids: number[]) {
  const response = await fetch("/api/affiliates", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Delete affiliates failed: ${response.status}`));
  }
}
