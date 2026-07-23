import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createRequestTimer } from "../../../lib/requestDiagnostics";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";
import { AffiliateRecord } from "../../affiliates/affiliateTypes";
import { affiliateToPayload, AffiliateRow, rowToAffiliate } from "./affiliateMapper";

export const dynamic = "force-dynamic";

function readPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    if (status !== "published") {
      const authError = await requireAdminRoute();
      if (authError) return authError;
    }
    const page = readPositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(readPositiveInteger(request.nextUrl.searchParams.get("pageSize"), 25), 50);
    const search = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
    const category = request.nextUrl.searchParams.get("category")?.trim().slice(0, 100) ?? "";
    const from = (page - 1) * pageSize;
    const timer = createRequestTimer("affiliates query", {
      source: "api",
      page,
      pageSize,
      status: status ?? "all",
      hasSearch: Boolean(search),
      hasCategory: Boolean(category)
    });
    const supabase = status === "published" ? createSupabaseReadClient() : createSupabaseAdminClient();
    let query = supabase
      .from("affiliates")
      .select("id,category,title,summary,status,published_date,slug,tags,image_url,link_url,html", { count: "exact" })
      .order("published_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (status === "published") {
      query = query.eq("status", "published");
    } else if (status === "draft") {
      query = query.eq("status", "draft");
    }
    if (search) query = query.ilike("title", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
    if (category) query = query.eq("category", category);

    const { data, count, error } = await query;

    if (error) {
      timer.end({ rows: 0, errorCode: error.code });
      throw error;
    }

    const rows = (data ?? []) as AffiliateRow[];
    timer.end({ rows: rows.length, totalRows: count ?? 0 });
    const transformTimer = createRequestTimer("data transform", { entity: "affiliates", inputRows: rows.length });
    const affiliates = rows.map(rowToAffiliate);
    transformTimer.end({ outputRows: affiliates.length });
    return NextResponse.json({ affiliates, page, pageSize, total: count ?? 0 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to load affiliates") }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const affiliate = (await request.json()) as AffiliateRecord;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("affiliates")
      .insert(affiliateToPayload(affiliate))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ affiliate: rowToAffiliate(data) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to create affiliate") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authError = await requireAdminRoute();
  if (authError) return authError;

  try {
    const body = (await request.json()) as { ids?: number[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isFinite) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing affiliate ids" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("affiliates").delete().in("id", ids);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to delete affiliates") }, { status: 500 });
  }
}
