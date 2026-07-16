export const visitorIdStorageKey = "japannote-visitor-id";

export function getOrCreateVisitorId() {
  let visitorId = window.localStorage.getItem(visitorIdStorageKey);

  if (!visitorId) {
    visitorId = window.crypto.randomUUID();
    window.localStorage.setItem(visitorIdStorageKey, visitorId);
  }

  return visitorId;
}
