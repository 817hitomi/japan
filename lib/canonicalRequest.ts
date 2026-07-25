export const canonicalSiteOrigin = "https://www.japan-note.com";

export function getCanonicalRedirect(request: Request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (hostname !== "japan-note.com" && hostname !== "www.japan-note.com") {
    return null;
  }

  if (url.protocol === "https:" && hostname === "www.japan-note.com") {
    return null;
  }

  const destination = new URL(`${url.pathname}${url.search}`, canonicalSiteOrigin);
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": "public, max-age=3600",
      Location: destination.toString()
    }
  });
}
