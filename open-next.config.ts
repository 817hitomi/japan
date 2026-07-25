import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2, KV, Durable Object, or other storage binding is used. The empty
// Cloudflare config resolves OpenNext's incremental, tag, and queue caches to
// their no-storage dummy implementations.
export default defineCloudflareConfig({});
