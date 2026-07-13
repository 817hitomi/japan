"use client";

import { AdSetting, defaultAdSettings, normalizeAdSettings } from "./adTypes";
import { readApiError } from "../../lib/apiErrors";

const adStorageKey = "japannote-ad-settings";

export type AdsReadResult = {
  source: "database" | "local";
  ads: AdSetting[];
  error?: string;
};

export function readStoredAds() {
  if (typeof window === "undefined") {
    return defaultAdSettings;
  }

  const raw = window.localStorage.getItem(adStorageKey);
  if (!raw) {
    window.localStorage.setItem(adStorageKey, JSON.stringify(defaultAdSettings));
    return defaultAdSettings;
  }

  try {
    return normalizeAdSettings(JSON.parse(raw));
  } catch {
    return defaultAdSettings;
  }
}

export function writeStoredAds(settings: AdSetting[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(adStorageKey, JSON.stringify(normalizeAdSettings(settings)));
  }
}

export async function fetchAdSettings() {
  const response = await fetch("/api/ads", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Ads API failed: ${response.status}`));
  }

  const payload = (await response.json()) as { ads?: AdSetting[] };
  return normalizeAdSettings(payload.ads);
}

export async function readAdsWithFallback() {
  const result = await readAdsWithSource();
  return result.ads;
}

export async function readAdsWithSource(): Promise<AdsReadResult> {
  try {
    const remoteAds = await fetchAdSettings();
    writeStoredAds(remoteAds);
    return { source: "database", ads: remoteAds };
  } catch (error) {
    return { source: "local", ads: readStoredAds(), error: error instanceof Error ? error.message : "Ads API failed" };
  }
}

export async function saveAdSettings(settings: AdSetting[]) {
  const normalized = normalizeAdSettings(settings);
  const response = await fetch("/api/ads", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ads: normalized })
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, `Save ads failed: ${response.status}`));
  }

  const payload = (await response.json()) as { ads?: AdSetting[] };
  const saved = normalizeAdSettings(payload.ads);
  writeStoredAds(saved);
  return saved;
}
