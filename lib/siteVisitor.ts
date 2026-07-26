import { readLocalStorage, writeLocalStorage } from "./browserStorage";

export const visitorIdStorageKey = "japannote-visitor-id";

export function getOrCreateVisitorId() {
  let visitorId = readLocalStorage(visitorIdStorageKey);

  if (!visitorId) {
    try {
      visitorId = window.crypto.randomUUID();
    } catch {
      visitorId = `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    writeLocalStorage(visitorIdStorageKey, visitorId);
  }

  return visitorId;
}
