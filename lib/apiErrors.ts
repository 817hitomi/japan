export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const record = error as { message?: unknown; details?: unknown; hint?: unknown };
    return [record.message, record.details, record.hint].filter((item): item is string => typeof item === "string" && item.length > 0).join(" ") || fallback;
  }

  return fallback;
}

export async function readApiError(response: Response, fallback: string) {
  const responseText = await response.text();

  if (!responseText) {
    return fallback;
  }

  try {
    const payload = JSON.parse(responseText) as { error?: unknown };
    return typeof payload.error === "string" && payload.error.length > 0 ? payload.error : responseText;
  } catch {
    return responseText;
  }
}
