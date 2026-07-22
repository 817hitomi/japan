import { NextRequest, NextResponse } from "next/server";
import { evaluateAdminAccess } from "../../../lib/adminAuth";
import { getRuntimeEnv } from "../../../lib/runtimeEnv";
import { createSupabaseAuthServerClient } from "../../../lib/supabase/authServer";

function safeAdminPath(value: string | null) {
  return value?.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeAdminPath(request.nextUrl.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=oauth", request.url), 303);

  try {
    const supabase = await createSupabaseAuthServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(new URL("/login?error=oauth", request.url), 303);

    const { data, error: userError } = await supabase.auth.getUser();
    const access = evaluateAdminAccess(userError ? null : data.user, getRuntimeEnv("ADMIN_EMAIL"));
    if (access.status === 200) return NextResponse.redirect(new URL(nextPath, request.url), 303);

    const error = access.status === 403 ? "forbidden" : access.status === 503 ? "configuration" : "oauth";
    return NextResponse.redirect(new URL(`/login?error=${error}&next=${encodeURIComponent(nextPath)}`, request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/login?error=configuration", request.url), 303);
  }
}

