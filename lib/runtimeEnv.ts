import { getCloudflareContext } from "@opennextjs/cloudflare";

export const bridgedRuntimeEnvNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAIL"
] as const;

type BridgedRuntimeEnvName = (typeof bridgedRuntimeEnvNames)[number];

export function getRuntimeEnvHeaderName(name: BridgedRuntimeEnvName) {
  return `x-japannote-runtime-${name.toLowerCase().replaceAll("_", "-")}`;
}

export function getRuntimeEnv(name: string, headers?: Headers) {
  if (headers && bridgedRuntimeEnvNames.includes(name as BridgedRuntimeEnvName)) {
    const value = headers.get(getRuntimeEnvHeaderName(name as BridgedRuntimeEnvName));
    if (value) return value;
  }

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
