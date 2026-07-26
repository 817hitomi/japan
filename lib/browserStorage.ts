export function readLocalStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readSessionStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
