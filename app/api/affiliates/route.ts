import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { requireAdminRoute } from "../../../lib/adminRouteAuth";
import { AffiliateRecord } from "../../affiliates/affiliateTypes";
import { affiliateToPayload, AffiliateRow, rowToAffiliate } from "./affiliateMapper";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    if (status !== "published") {
      const authError = await requireAdminRoute();
      if (authError) return authError;
    }
    const supabase = status === "published" ? createSupabaseReadClient() : createSupabaseAdminClient();
    let query = supabase
      .from("affiliates")
      .select("*")
      .order("published_date", { ascending: false })
      .order("id", { ascending: false });

    if (status === "published") {
      query = query.eq("status", "published");
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ affiliates: ((data ?? []) as AffiliateRow[]).map(rowToAffiliate) });
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
