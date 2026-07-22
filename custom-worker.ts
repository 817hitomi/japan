import { createSecurityFirstFetchHandler } from "./lib/securityFirstRequest";

// The OpenNext worker is generated after the Next.js build.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
import openNextWorker from "./.open-next/worker.js";

type WorkerEnvironment = {
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
};

const fetch = createSecurityFirstFetchHandler(
  (request, env: WorkerEnvironment, context) => {
    const url = new URL(request.url);

    // OpenNext's asset resolver does not consistently apply the middleware rewrite for favicon.ico.
    if (url.pathname === "/favicon.ico" && env.ASSETS) {
      return env.ASSETS.fetch(new Request(new URL("/brand/logo_b.png", request.url), request));
    }

    return openNextWorker.fetch(request, env, context);
  }
);

export default { fetch };

// Preserve OpenNext Durable Object exports when cache implementations enable them.
// @ts-expect-error Generated build artifact is intentionally absent in a fresh checkout.
export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
