export const transientCloudflareErrorMessages = [
  "Network connection lost",
  "storage caused object to be reset",
  "reset because its code was updated",
  "Cannot resolve D1 DB due to transient issue"
] as const;

type StageLogFields = {
  route: string;
  slug: string;
  stage: string;
  attempt: number;
  requestId: string;
};

type ReadRetryOptions = Omit<StageLogFields, "attempt"> & {
  maxAttempts?: number;
  baseDelayMs?: number;
  jitterMs?: number;
  logger?: (message: string) => void;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
};

const retryAttemptByError = new WeakMap<object, number>();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function errorCauseMessage(error: unknown) {
  if (!(error instanceof Error) || error.cause === undefined) return "";
  return error.cause instanceof Error ? error.cause.message : String(error.cause);
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

export function getCloudflareErrorDetails(error: unknown) {
  return {
    errorName: errorName(error),
    errorMessage: errorMessage(error),
    errorCauseMessage: errorCauseMessage(error)
  };
}

export function getReadRetryAttempt(error: unknown) {
  return typeof error === "object" && error !== null
    ? retryAttemptByError.get(error) ?? 1
    : 1;
}

export function isTransientCloudflareError(error: unknown) {
  const message = `${errorMessage(error)} ${errorCauseMessage(error)}`.toLowerCase();
  return transientCloudflareErrorMessages.some((candidate) =>
    message.includes(candidate.toLowerCase())
  );
}

export function resolveRequestId(request: Request) {
  return (
    request.headers.get("x-japannote-request-id") ??
    request.headers.get("cf-ray") ??
    request.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}

export function logCloudflareStage(
  event: "start" | "success" | "error" | "fallback",
  fields: StageLogFields & Partial<ReturnType<typeof getCloudflareErrorDetails>>,
  logger: (message: string) => void = console.log
) {
  logger(JSON.stringify({
    source: "japannote",
    event,
    ...fields
  }));
}

export async function withReadRetry<T>(
  operation: () => Promise<T>,
  options: ReadRetryOptions
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 4));
  const baseDelayMs = options.baseDelayMs ?? 100;
  const jitterMs = options.jitterMs ?? 100;
  const logger = options.logger ?? console.log;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((delayMs: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const fields = {
      route: options.route,
      slug: options.slug,
      stage: options.stage,
      attempt,
      requestId: options.requestId
    };
    logCloudflareStage("start", fields, logger);

    try {
      const result = await operation();
      logCloudflareStage("success", fields, logger);
      return result;
    } catch (error) {
      lastError = error;
      if (typeof error === "object" && error !== null) {
        retryAttemptByError.set(error, attempt);
      }
      logCloudflareStage("error", {
        ...fields,
        ...getCloudflareErrorDetails(error)
      }, logger);

      if (!isTransientCloudflareError(error) || attempt === maxAttempts) {
        throw error;
      }

      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = Math.floor(random() * jitterMs);
      await sleep(backoff + jitter);
    }
  }

  throw lastError;
}
