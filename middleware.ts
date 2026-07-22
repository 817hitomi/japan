import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { evaluateAdminAccess } from "./lib/adminAuth";
import { createRequestTimer } from "./lib/requestDiagnostics";
import { getRuntimeEnv } from "./lib/runtimeEnv";

const protectedApiPrefixes = ["/api/uploads"];
const adminWriteApiPrefixes = ["/api/ads", "/api/words", "/api/quiz", "/api/quotes", "/api/affiliates"];
const publicAssetPrefixes = ["/_next/static", "/_next/image", "/brand"];
const knownStaticFiles = new Set(["/ads.txt", "/robots.txt", "/sitemap.xml"]);
const blockedPathPatterns = [
  /(?:^|\/)wp-admin(?:\/|$)/i,
  /(?:^|\/)wp-content(?:\/|$)/i,
  /(?:^|\/)wp-includes(?:\/|$)/i,
  /(?:^|\/)wp-login(?:\.php)?(?:\/|$)/i,
  /(?:^|\/)xmlrpc\.php(?:\/|$)/i,
  /(?:^|\/)wlwmanifest\.xml(?:\/|$)/i
];
const knownApiRoutes = new Set([
  "/api/ads", "/api/affiliates", "/api/admin/site-analytics", "/api/content-reports", "/api/home-stats",
  "/api/notes", "/api/notes/og", "/api/quiz", "/api/quiz/categories", "/api/quotes", "/api/site-page-view",
  "/api/site-stats", "/api/uploads", "/api/words"
]);
const knownPublicRoutes = new Set([
  "/", "/about", "/affiliates", "/auth/callback", "/cookies", "/disclaimer", "/login", "/notes", "/privacy",
  "/quiz", "/quiz/random-10", "/quiz/random-20", "/quiz/vocabulary", "/terms", "/words"
]);
const blockedProbeRoutes = new Set(["/app", "/console", "/dashboard", "/settings"]);
const staticAssetPattern = /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|mp3|mp4|ogg|otf|png|svg|ttf|txt|webm|webp|woff|woff2|xml)$/i;

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isBlockedProbePath(pathname: string) {
  return blockedPathPatterns.some((pattern) => pattern.test(pathname));
}

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isKnownApiPath(pathname: string) {
  return knownApiRoutes.has(pathname) || /^\/api\/(?:affiliates|notes|quiz|quotes|words)\/[^/]+$/.test(pathname);
}

function isKnownAdminPagePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isPublicAssetPath(pathname: string) {
  return pathname === "/favicon.ico" || publicAssetPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function quick404() {
  return new NextResponse("Not Found", { status: 404, headers: { "Cache-Control": "public, max-age=86400", "Content-Type": "text/plain; charset=UTF-8" } });
}

function quickApi404() {
  return NextResponse.json({ error: "Not Found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}

function isKnownDynamicPagePath(pathname: string) {
  if (pathname.startsWith("/notes/")) return pathname.split("/").filter(Boolean).length === 2;
  if (pathname.startsWith("/words/")) {
    const [, section, page] = pathname.split("/");
    return section === "words" && /^\d+$/.test(page ?? "");
  }
  return false;
}

function shouldFast404(pathname: string) {
  if (isBlockedProbePath(pathname)) return "blocked-probe";
  if (pathname.endsWith(".map")) return "source-map";
  if (blockedProbeRoutes.has(pathname)) return "probe-route";
  if (knownPublicRoutes.has(pathname) || knownStaticFiles.has(pathname) || isKnownDynamicPagePath(pathname)) return "";
  if (isKnownApiPath(pathname) || isKnownAdminPagePath(pathname) || isPublicAssetPath(pathname)) return "";
  if (staticAssetPattern.test(pathname)) return "missing-static-asset";
  return "unknown-route";
}

export function isProtectedRequest(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const { searchParams } = request.nextUrl;
  if (isPublicAssetPath(pathname)) return false;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname === "/api/content-reports") return request.method !== "POST";
  if (protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname === "/api/affiliates" && request.method === "GET") return searchParams.get("status") !== "published";
  if (pathname === "/api/affiliates" && request.method === "GET") return searchParams.get("status") !== "published";
  if (adminWriteApiPrefixes.some((prefix) => pathname.startsWith(prefix))) return request.method !== "GET";
  if (pathname === "/api/notes") return request.method !== "GET" || searchParams.get("status") !== "published";
  if (pathname === "/api/notes/og") return request.method !== "GET";
  if (pathname.startsWith("/api/notes/")) return true;
  return false;
}

function copyAuthCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set("Cache-Control", "private, no-store");
  return target;
}

function deniedResponse(request: NextRequest, status: 401 | 403 | 503, authResponse: NextResponse) {
  if (isApiPath(request.nextUrl.pathname)) {
    const message = status === 403 ? "Forbidden" : status === 503 ? "Auth configuration unavailable" : "Unauthorized";
    return copyAuthCookies(authResponse, NextResponse.json({ error: message }, { status }));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (status === 403) loginUrl.searchParams.set("error", "forbidden");
  if (status === 503) loginUrl.searchParams.set("error", "configuration");
  return copyAuthCookies(authResponse, NextResponse.rewrite(loginUrl, { status }));
}

export async function middleware(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const startedAt = performance.now();
  const timer = createRequestTimer("middleware", { method: request.method, path: pathname });

  function finish(response: NextResponse, branch: string, details: { reason?: string; maskedEmail?: string } = {}) {
    console.log(JSON.stringify({
      source: "japannote", stage: "middleware-route", pathname, method: request.method, branch,
      ...details, status: response.status, elapsedMs: Math.round(performance.now() - startedAt)
    }));
    timer.end({ status: response.status });
    return response;
  }

  if (pathname === "/favicon.ico") {
    return finish(NextResponse.rewrite(new URL("/brand/logo_b.png", request.url)), "favicon-rewrite");
  }
  if (isApiPath(pathname) && !isKnownApiPath(pathname)) return finish(quickApi404(), "api-404", { reason: "unknown-api-route" });
  const fast404Reason = shouldFast404(pathname);
  if (fast404Reason) return finish(quick404(), "fast-404", { reason: fast404Reason });
  if (!isProtectedRequest(request)) return finish(NextResponse.next(), "next");

  const supabaseUrl = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  let authResponse = NextResponse.next({ request });

  if (!supabaseUrl || !anonKey) {
    const response = deniedResponse(request, 503, authResponse);
    return finish(response, "protected-misconfigured");
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        authResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => authResponse.cookies.set(name, value, options));
      }
    }
  });

  const { data, error } = await supabase.auth.getUser();
  const access = evaluateAdminAccess(error ? null : data.user, getRuntimeEnv("ADMIN_EMAIL"));

  if (access.status !== 200) {
    const response = deniedResponse(request, access.status, authResponse);
    return finish(response, access.branch);
  }

  authResponse.headers.set("Cache-Control", "private, no-store");
  return finish(authResponse, access.branch, { maskedEmail: access.maskedEmail });
}

export const config = { matcher: ["/((?!_next/static|_next/image|brand).*)"] };
