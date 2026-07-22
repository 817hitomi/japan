import { NextResponse } from "next/server";
import { evaluateAdminAccess } from "./adminAuth";
import { getRuntimeEnv } from "./runtimeEnv";
import { createSupabaseAuthServerClient } from "./supabase/authServer";

export async function requireAdminRoute() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data, error } = await supabase.auth.getUser();
    const access = evaluateAdminAccess(error ? null : data.user, getRuntimeEnv("ADMIN_EMAIL"));

    if (access.status === 200) {
      return null;
    }

    return NextResponse.json(
      { error: access.status === 403 ? "Forbidden" : access.status === 503 ? "Auth configuration unavailable" : "Unauthorized" },
      { status: access.status, headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Auth configuration unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}

