import { NextRequest, NextResponse } from "next/server";
import { createRequestTimer } from "./lib/requestDiagnostics";
import { getRuntimeEnv } from "./lib/runtimeEnv";

const protectedApiPrefixes = ["/api/uploads"];
const adminWriteApiPrefixes = ["/api/ads", "/api/words", "/api/quiz"];
const publicAssetPrefixes = ["/_next/static", "/_next/image", "/brand"];
const knownStaticFiles = new Set(["/ads.txt", "/robots.txt", "/sitemap.xml"]);
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

function isPublicAssetPath(pathname: string) {
  return pathname === "/favicon.ico" || publicAssetPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function quick404() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=300"
    }
  });
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
  if (pathname.endsWith(".map")) {
    return "source-map";
  }

  if (blockedProbeRoutes.has(pathname)) {
    return "probe-route";
  }

  if (knownPublicRoutes.has(pathname) || knownStaticFiles.has(pathname) || isKnownDynamicPagePath(pathname)) {
    return "";
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/admin") || isPublicAssetPath(pathname)) {
    return "";
  }

  if (staticAssetPattern.test(pathname)) {
    return "missing-static-asset";
  }

  return "unknown-route";
}

function isProtectedPath(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

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
  const { pathname } = request.nextUrl;
  const timer = createRequestTimer("middleware", { method: request.method, path: pathname });

  if (pathname === "/favicon.ico") {
    timer.mark("route match", { action: "favicon-rewrite" });
    const response = NextResponse.rewrite(new URL("/brand/logo_b.png", request.url));
    timer.end({ status: 200 });
    return response;
  }

  const fast404Reason = shouldFast404(pathname);
  if (fast404Reason) {
    timer.mark("route match", { action: "fast-404", reason: fast404Reason });
    const response = quick404();
    timer.end({ status: 404 });
    return response;
  }

  if (!isProtectedPath(request)) {
    timer.mark("route match", { action: "next" });
    const response = NextResponse.next();
    timer.end({ status: 200 });
    return response;
  }

  timer.mark("route match", { action: "protected" });
  const adminUsername = getRuntimeEnv("ADMIN_USERNAME") || "admin";
  const adminPassword = getRuntimeEnv("ADMIN_PASSWORD");

  if (!adminPassword) {
    if (getRuntimeEnv("NODE_ENV") !== "production") {
      const response = NextResponse.next();
      timer.end({ status: 200 });
      return response;
    }

    const response = new NextResponse("Missing ADMIN_PASSWORD", { status: 503 });
    timer.end({ status: 503 });
    return response;
  }

  const credentials = getCredentials(request);

  if (!credentials || credentials.username !== adminUsername || credentials.password !== adminPassword) {
    const response = unauthorized();
    timer.end({ status: 401 });
    return response;
  }

  const response = NextResponse.next();
  timer.end({ status: 200 });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|brand|favicon.ico|.*\\.(?:avif|css|gif|ico|jpg|jpeg|js|json|map|mp3|mp4|ogg|otf|png|svg|ttf|txt|webm|webp|woff|woff2|xml)$).*)"
  ]
};
