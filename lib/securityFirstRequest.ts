const sensitivePathSegments = new Set([
  ".git",
  "node_modules",
  "wrangler.toml",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
]);

const rootSensitiveDirectories = new Set(["src", "backup", "staging"]);
const sensitiveEnvironmentFilePattern = /^\.env(?:\..+)?$/i;
const blockedScannerSegments = new Set(["wp-admin", "wp-content", "wp-includes"]);

type SecurityStage = "middleware-route" | "worker-route";
type SecurityLogger = (message: string) => void;

const allowedProductionHosts = new Set(["japan-note.com", "www.japan-note.com"]);
const localDevelopmentHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isDisallowedProductionHost(request: Pick<Request, "url">) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (localDevelopmentHostnames.has(hostname)) return false;

  return !allowedProductionHosts.has(url.host.toLowerCase());
}

export function createDisallowedHostResponse(
  request: Pick<Request, "method" | "url">,
  stage: SecurityStage,
  startedAt = performance.now(),
  logger: SecurityLogger = console.log
) {
  const url = new URL(request.url);
  const response = new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Length": "9",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });

  logger(JSON.stringify({
    source: "japannote",
    stage,
    hostname: url.hostname.toLowerCase(),
    port: url.port,
    method: request.method,
    branch: "fast-404",
    reason: "disallowed-production-host",
    status: 404,
    elapsedMs: Math.round(performance.now() - startedAt)
  }));

  return response;
}

function decodePathname(pathname: string) {
  let decoded = pathname;

  // Decode twice so common double-encoding cannot hide a sensitive segment.
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }

  return decoded;
}

export function normalizeSecurityPathname(pathname: string) {
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized = decodePathname(withLeadingSlash)
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");

  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

export function isBlockedSensitivePath(pathname: string) {
  const normalized = normalizeSecurityPathname(pathname);
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length === 0) return false;

  if (rootSensitiveDirectories.has(segments[0].toLowerCase())) return true;

  return segments.some((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return sensitivePathSegments.has(normalizedSegment) || sensitiveEnvironmentFilePattern.test(segment);
  });
}

export function isAcmeChallengePath(pathname: string) {
  return normalizeSecurityPathname(pathname).toLowerCase().startsWith("/.well-known/acme-challenge/");
}
export function isBlockedScannerPath(pathname: string) {
  const normalized = normalizeSecurityPathname(pathname).toLowerCase();
  const segments = normalized.split("/").filter(Boolean);

  if (normalized.endsWith(".php")) return true;

  return segments.some((segment) => blockedScannerSegments.has(segment));
}

function createStaticNotFoundResponse(
  pathname: string,
  method: string,
  stage: SecurityStage,
  reason: "blocked-sensitive-path" | "blocked-scanner-path" | "acme-challenge",
  startedAt: number,
  logger: SecurityLogger
) {
  const normalizedPathname = normalizeSecurityPathname(pathname);
  const response = new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Length": "9",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });

  logger(JSON.stringify({
    source: "japannote",
    stage,
    pathname: normalizedPathname,
    method,
    branch: "fast-404",
    reason,
    status: 404,
    elapsedMs: Math.round(performance.now() - startedAt)
  }));

  return response;
}

export function createBlockedSensitivePathResponse(
  pathname: string,
  method: string,
  stage: SecurityStage,
  startedAt = performance.now(),
  logger: SecurityLogger = console.log
) {
  return createStaticNotFoundResponse(
    pathname,
    method,
    stage,
    "blocked-sensitive-path",
    startedAt,
    logger
  );
}

export function createBlockedScannerPathResponse(
  pathname: string,
  method: string,
  stage: SecurityStage,
  startedAt = performance.now(),
  logger: SecurityLogger = console.log
) {
  return createStaticNotFoundResponse(
    pathname,
    method,
    stage,
    "blocked-scanner-path",
    startedAt,
    logger
  );
}

type DownstreamFetch<Environment, Context> = (
  request: Request,
  env: Environment,
  context: Context
) => Response | Promise<Response>;

export function createSecurityFirstFetchHandler<Environment, Context>(
  downstreamFetch: DownstreamFetch<Environment, Context>,
  logger: SecurityLogger = console.log
) {
  return async (request: Request, env: Environment, context: Context) => {
    const startedAt = performance.now();

    if (isDisallowedProductionHost(request)) {
      return createDisallowedHostResponse(request, "worker-route", startedAt, logger);
    }

    const pathname = normalizeSecurityPathname(new URL(request.url).pathname);

    if (isBlockedSensitivePath(pathname)) {
      return createBlockedSensitivePathResponse(pathname, request.method, "worker-route", startedAt, logger);
    }

    if (isAcmeChallengePath(pathname)) {
      return createStaticNotFoundResponse(
        pathname,
        request.method,
        "worker-route",
        "acme-challenge",
        startedAt,
        logger
      );
    }

    if (isBlockedScannerPath(pathname)) {
      return createBlockedScannerPathResponse(pathname, request.method, "worker-route", startedAt, logger);
    }

    return downstreamFetch(request, env, context);
  };
}
