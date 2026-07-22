import type { User } from "@supabase/supabase-js";
import { evaluateAdminAccess } from "../lib/adminAuth";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function googleUser(email: string, verified = true) {
  return {
    id: "test-user-id",
    email,
    email_confirmed_at: verified ? "2026-07-22T00:00:00.000Z" : undefined,
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-22T00:00:00.000Z",
    identities: [
      {
        id: "google-identity-id",
        user_id: "test-user-id",
        identity_id: "google-identity-id",
        provider: "google",
        identity_data: { email, email_verified: verified },
        created_at: "2026-07-22T00:00:00.000Z",
        updated_at: "2026-07-22T00:00:00.000Z",
        last_sign_in_at: "2026-07-22T00:00:00.000Z"
      }
    ]
  } as User;
}

const unauthorized = evaluateAdminAccess(null, "admin@example.com");
assert(unauthorized.status === 401 && unauthorized.branch === "protected-unauthorized", "signed-out user must receive 401");

const forbidden = evaluateAdminAccess(googleUser("other@example.com"), "admin@example.com");
assert(forbidden.status === 403 && forbidden.branch === "protected-forbidden", "non-admin Google user must receive 403");

const unverified = evaluateAdminAccess(googleUser("admin@example.com", false), "admin@example.com");
assert(unverified.status === 403, "unverified Google identity must receive 403");

const authorized = evaluateAdminAccess(googleUser("Admin@Example.com"), "admin@example.com");
assert(authorized.status === 200 && authorized.branch === "protected-authorized", "configured admin must receive 200");
assert(authorized.status === 200 && authorized.maskedEmail !== "admin@example.com", "authorized log email must be masked");

const misconfigured = evaluateAdminAccess(googleUser("admin@example.com"), undefined);
assert(misconfigured.status === 503, "missing ADMIN_EMAIL must fail closed");

console.log("admin auth assertions passed");

