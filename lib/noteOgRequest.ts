import {
  getCloudflareErrorDetails,
  getReadRetryAttempt,
  logCloudflareStage,
  resolveRequestId,
  withReadRetry
} from "./cloudflareReadRetry.ts";

export const noteOgSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const noteOgMaxSlugLength = 100;
export const noteOgRoute = "/api/notes/og";

export const noteOgPositiveCacheControl =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
export const noteOgNegativeCacheControl =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
export const noteOgUnavailableCacheControl = "no-store, max-age=0";

export function isValidNoteOgSlug(value: string | null): value is string {
  return value !== null && value.length <= noteOgMaxSlugLength && noteOgSlugPattern.test(value);
}

function errorResponse(message: string, status: 400 | 404) {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": noteOgNegativeCacheControl,
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function unavailableResponse(requestId: string) {
  return Response.json(
    {
      error: "OG image temporarily unavailable",
      requestId,
      retryable: true
    },
    {
      status: 503,
      headers: {
        "Cache-Control": noteOgUnavailableCacheControl,
        "Retry-After": "5"
      }
    }
  );
}

export type NoteOgRequestContext = {
  route: typeof noteOgRoute;
  slug: string;
  requestId: string;
};

export type NoteOgRequestDependencies<Note> = {
  findNote: (slug: string, context: NoteOgRequestContext) => Promise<Note | null>;
  renderNote: (note: Note, context: NoteOgRequestContext) => Promise<Response> | Response;
  logger?: (message: string) => void;
  retry?: {
    baseDelayMs?: number;
    jitterMs?: number;
    maxAttempts?: number;
    random?: () => number;
    sleep?: (delayMs: number) => Promise<void>;
  };
};

export async function handleNoteOgRequest<Note>(
  request: Request,
  dependencies: NoteOgRequestDependencies<Note>
) {
  const slug = new URL(request.url).searchParams.get("slug");

  if (!isValidNoteOgSlug(slug)) {
    return errorResponse("Invalid slug", 400);
  }

  const requestId = resolveRequestId(request);
  const context: NoteOgRequestContext = { route: noteOgRoute, slug, requestId };
  const retryOptions = {
    ...context,
    ...dependencies.retry,
    logger: dependencies.logger
  };

  try {
    const note = await withReadRetry(
      () => dependencies.findNote(slug, context),
      { ...retryOptions, stage: "supabase-public-note-read" }
    );

    if (!note) {
      return errorResponse("Not Found", 404);
    }

    const response = await withReadRetry(
      () => Promise.resolve(dependencies.renderNote(note, context)),
      { ...retryOptions, stage: "og-image-render" }
    );
    response.headers.set("Cache-Control", noteOgPositiveCacheControl);
    return response;
  } catch (error) {
    logCloudflareStage("fallback", {
      ...context,
      stage: "og-request",
      attempt: getReadRetryAttempt(error),
      ...getCloudflareErrorDetails(error)
    }, dependencies.logger ?? console.error);
    return unavailableResponse(requestId);
  }
}
