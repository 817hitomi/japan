import { createSecurityFirstFetchHandler } from "./lib/securityFirstRequest";
import { bridgedRuntimeEnvNames, getRuntimeEnvHeaderName } from "./lib/runtimeEnv";

// The OpenNext worker is generated after the Next.js build.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
import openNextWorker from "./.open-next/worker.js";

type WorkerEnvironment = {
  [key: string]: unknown;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

function withRuntimeEnvHeaders(request: Request, env: WorkerEnvironment) {
  const headers = new Headers(request.headers);

  for (const name of bridgedRuntimeEnvNames) {
    const headerName = getRuntimeEnvHeaderName(name);
    const value = env[name];

    // Always replace or remove client-supplied internal headers so callers
    // cannot spoof authentication configuration.
    if (typeof value === "string" && value.length > 0) headers.set(headerName, value);
    else headers.delete(headerName);
  }

  return new Request(request, { headers });
}

const fetch = createSecurityFirstFetchHandler(
  (request, env: WorkerEnvironment, context) => {
    const url = new URL(request.url);

    // OpenNext's asset resolver does not consistently apply the middleware rewrite for favicon.ico.
    if (url.pathname === "/favicon.ico" && env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/brand/logo_b.png", request.url), request));
    }

    return openNextWorker.fetch(withRuntimeEnvHeaders(request, env), env, context);
  }
);

export default { fetch };

// Preserve OpenNext Durable Object exports when cache implementations enable them.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
