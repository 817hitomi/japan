export const noteOgSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const noteOgMaxSlugLength = 100;

export const noteOgPositiveCacheControl =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
export const noteOgNegativeCacheControl =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

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

export type NoteOgRequestDependencies<Note> = {
  findNote: (slug: string) => Promise<Note | null>;
  renderNote: (note: Note) => Promise<Response> | Response;
};

export async function handleNoteOgRequest<Note>(
  request: Request,
  dependencies: NoteOgRequestDependencies<Note>
) {
  const slug = new URL(request.url).searchParams.get("slug");

  if (!isValidNoteOgSlug(slug)) {
    return errorResponse("Invalid slug", 400);
  }

  const note = await dependencies.findNote(slug);

  if (!note) {
    return errorResponse("Not Found", 404);
  }

  const response = await dependencies.renderNote(note);
  response.headers.set("Cache-Control", noteOgPositiveCacheControl);
  return response;
}
