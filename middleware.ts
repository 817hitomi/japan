import { NextRequest, NextResponse } from "next/server";
import { createRequestTimer } from "./lib/requestDiagnostics";
import { getRuntimeEnv } from "./lib/runtimeEnv";

const protectedApiPrefixes = ["/api/uploads"];
const adminWriteApiPrefixes = ["/api/ads", "/api/words", "/api/quiz"];
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
  "/api/ads",
  "/api/affiliates",
  "/api/admin/site-analytics",
  "/api/content-reports",
  "/api/home-stats",
  "/api/notes",
  "/api/notes/og",
  "/api/quiz",
  "/api/quiz/categories",
  "/api/quotes",
  "/api/site-page-view",
  "/api/site-stats",
  "/api/uploads",
  "/api/words"
]);
const knownPublicRoutes = new Set([
  "/",
  "/about",
  "/affiliates",
  "/cookies",
  "/disclaimer",
  "/notes",
  "/privacy",
  "/quiz",
  "/quiz/random-10",
  "/quiz/random-20",
  "/quiz/vocabulary",
  "/terms",
  "/words"
]);
const blockedProbeRoutes = new Set(["/app", "/console", "/dashboard", "/login", "/settings"]);
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
  if (pathname === "/admin" || /^\/admin\/(?:affiliates|notes|quiz|quotes|reports|settings|words)$/.test(pathname)) {
    return true;
  }

  return /^\/admin\/(?:notes|words)\/[^/]+$/.test(pathname);
}

function isPublicAssetPath(pathname: string) {
  return pathname === "/favicon.ico" || publicAssetPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function quick404() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/plain; charset=UTF-8"
    }
  });
}

function quickApi404() {
  return NextResponse.json(
    { error: "Not Found" },
    {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

function isKnownDynamicPagePath(pathname: string) {
  if (pathname.startsWith("/notes/")) {
    return pathname.split("/").filter(Boolean).length === 2;
  }

  if (pathname.startsWith("/words/")) {
    const [, section, page] = pathname.split("/");
    return section === "words" && /^\d+$/.test(page ?? "");
  }

  return false;
}

function shouldFast404(pathname: string) {
  if (isBlockedProbePath(pathname)) {
    return "blocked-probe";
  }

  if (pathname.endsWith(".map")) {
    return "source-map";
  }

  if (blockedProbeRoutes.has(pathname)) {
    return "probe-route";
  }

  if (knownPublicRoutes.has(pathname) || knownStaticFiles.has(pathname) || isKnownDynamicPagePath(pathname)) {
    return "";
  }

  if (isKnownApiPath(pathname) || isKnownAdminPagePath(pathname) || isPublicAssetPath(pathname)) {
    return "";
  }

  if (staticAssetPattern.test(pathname)) {
    return "missing-static-asset";
  }

  return "unknown-route";
}

function isProtectedPath(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const { searchParams } = request.nextUrl;

  if (isPublicAssetPath(pathname)) {
    return false;
  }

  if (pathname.startsWith("/admin")) {
    return true;
  }

  if (pathname === "/api/content-reports") {
    return request.method !== "POST";
  }

  if (protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (adminWriteApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return request.method !== "GET";
  }

  if (pathname === "/api/notes") {
    return request.method !== "GET" || searchParams.get("status") !== "published";
  }

  if (pathname === "/api/notes/og") {
    return request.method !== "GET";
  }

  if (pathname.startsWith("/api/notes/")) {
    return true;
  }

  return false;
}

function unauthorized(message = "Unauthorized") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="JapanNote Admin", charset="UTF-8"'
    }
  });
}

function getCredentials(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = normalizePathname(request.nextUrl.pathname);
  const startedAt = performance.now();
  const timer = createRequestTimer("middleware", { method: request.method, path: pathname });

  function finish(response: NextResponse, branch: string, reason?: string) {
    console.log(
      JSON.stringify({
        source: "japannote",
        stage: "middleware-route",
        pathname,
        method: request.method,
        branch,
        reason,
        status: response.status,
        elapsedMs: Math.round(performance.now() - startedAt)
      })
    );
    timer.end({ status: response.status });
    return response;
  }

  if (pathname === "/favicon.ico") {
    timer.mark("route match", { action: "favicon-rewrite" });
    const response = NextResponse.rewrite(new URL("/brand/logo_b.png", request.url));
    return finish(response, "favicon-rewrite");
  }

  if (isApiPath(pathname) && !isKnownApiPath(pathname)) {
    timer.mark("route match", { action: "api-404" });
    return finish(quickApi404(), "api-404", "unknown-api-route");
  }

  const fast404Reason = shouldFast404(pathname);
  if (fast404Reason) {
    timer.mark("route match", { action: "fast-404", reason: fast404Reason });
    return finish(quick404(), "fast-404", fast404Reason);
  }

  if (!isProtectedPath(request)) {
    timer.mark("route match", { action: "next" });
    const response = NextResponse.next();
    if (pathname.startsWith("/notes/")) {
      response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
    }
    return finish(response, "next");
  }

  timer.mark("route match", { action: "protected" });
  const adminUsername = getRuntimeEnv("ADMIN_USERNAME") || "admin";
  const adminPassword = getRuntimeEnv("ADMIN_PASSWORD");

  if (!adminPassword) {
    if (getRuntimeEnv("NODE_ENV") !== "production") {
      const response = NextResponse.next();
      return finish(response, "protected-development-bypass");
    }

    const response = new NextResponse("Missing ADMIN_PASSWORD", { status: 503 });
    return finish(response, "protected-missing-password");
  }

  const credentials = getCredentials(request);

  if (!credentials || credentials.username !== adminUsername || credentials.password !== adminPassword) {
    const response = unauthorized();
    return finish(response, "protected-unauthorized");
  }

  const response = NextResponse.next();
  return finish(response, "protected-authorized");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand).*)"
  ]
};
