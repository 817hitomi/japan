import type { User } from "@supabase/supabase-js";

export type AdminAccessResult =
  | { status: 200; branch: "protected-authorized"; maskedEmail: string }
  | { status: 401; branch: "protected-unauthorized" }
  | { status: 403; branch: "protected-forbidden" }
  | { status: 503; branch: "protected-misconfigured" };

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function maskEmail(email: string) {
  const [localPart, domain = ""] = email.split("@");
  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
  const maskedLocal = `${visibleLocal}${"*".repeat(Math.max(3, localPart.length - visibleLocal.length))}`;
  const domainParts = domain.split(".");
  const domainName = domainParts.shift() ?? "";
  const maskedDomain = domainName ? `${domainName.slice(0, 1)}***` : "***";

  return `${maskedLocal}@${[maskedDomain, ...domainParts].filter(Boolean).join(".")}`;
}

function hasVerifiedGoogleIdentity(user: User, email: string) {
  const provider = user.app_metadata?.provider;
  const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
  const hasGoogleProvider = provider === "google" || providers.includes("google");

  return (
    hasGoogleProvider &&
    Boolean(user.email_confirmed_at) &&
    (user.identities ?? []).some((identity) => {
      const identityEmail = normalizeEmail(identity.identity_data?.email as string | undefined);
      return identity.provider === "google" && identity.identity_data?.email_verified === true && identityEmail === email;
    })
  );
}

export function evaluateAdminAccess(user: User | null, configuredAdminEmail: string | undefined): AdminAccessResult {
  const adminEmail = normalizeEmail(configuredAdminEmail);

  if (!adminEmail) {
    return { status: 503, branch: "protected-misconfigured" };
  }

  if (!user) {
    return { status: 401, branch: "protected-unauthorized" };
  }

  const userEmail = normalizeEmail(user.email);

  if (!userEmail || !hasVerifiedGoogleIdentity(user, userEmail) || userEmail !== adminEmail) {
    return { status: 403, branch: "protected-forbidden" };
  }

  return {
    status: 200,
    branch: "protected-authorized",
    maskedEmail: maskEmail(userEmail)
  };
}

