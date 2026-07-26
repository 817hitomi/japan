export function getOAuthCallbackFallbackRedirect(request: Request) {
  if (request.method !== "GET") return null;

  const url = new URL(request.url);
  const code = url.pathname === "/" ? url.searchParams.get("code")?.trim() : "";

  if (!code) return null;

  const destination = new URL("/auth/callback", url);
  destination.searchParams.set("code", code);
  destination.searchParams.set("next", "/admin");

  return Response.redirect(destination, 303);
}
