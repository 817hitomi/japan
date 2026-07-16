import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizePagePath(pagePath?: string) {
  const value = pagePath?.trim();

  if (!value || value.length > 500) {
    return null;
  }

  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeText(value?: string, maxLength = 500) {
  const text = value?.trim();
  return text ? text.slice(0, maxLength) : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      visitorId?: string;
      pagePath?: string;
      pageTitle?: string;
      referrer?: string;
    };
    const visitorId = normalizeText(body.visitorId, 120);
    const pagePath = normalizePagePath(body.pagePath);

    if (!visitorId || !pagePath) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("site_visit_events").insert({
      visitor_id: visitorId,
      page_path: pagePath,
      page_title: normalizeText(body.pageTitle, 200),
      referrer: normalizeText(body.referrer),
      user_agent: normalizeText(request.headers.get("user-agent") ?? undefined, 500)
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
