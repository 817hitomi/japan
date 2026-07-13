import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getRuntimeEnv(name: string) {
  try {
    const cloudflareEnv = getCloudflareContext().env as Record<string, unknown>;
    const value = cloudflareEnv[name];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  } catch {
    // Local Next.js dev does not always initialize the Cloudflare context.
  }

  return process.env[name];
}
