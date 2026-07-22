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

type SecurityStage = "middleware-route" | "worker-route";
type SecurityLogger = (message: string) => void;

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

export function createBlockedSensitivePathResponse(
  pathname: string,
  method: string,
  stage: SecurityStage,
  startedAt = performance.now(),
  logger: SecurityLogger = console.log
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
    reason: "blocked-sensitive-path",
    status: 404,
    elapsedMs: Math.round(performance.now() - startedAt)
  }));

  return response;
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
    const pathname = normalizeSecurityPathname(new URL(request.url).pathname);

    if (isBlockedSensitivePath(pathname)) {
      return createBlockedSensitivePathResponse(pathname, request.method, "worker-route", startedAt, logger);
    }

    return downstreamFetch(request, env, context);
  };
}
