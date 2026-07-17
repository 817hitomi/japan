import { NextRequest, NextResponse } from "next/server";
import { getApiErrorMessage } from "../../../../lib/apiErrors";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { AffiliateRecord } from "../../../affiliates/affiliateTypes";
import { affiliateToPayload, rowToAffiliate } from "../affiliateMapper";

type AffiliateRouteParams = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: AffiliateRouteParams) {
  try {
    const { id } = await params;
    const affiliate = (await request.json()) as AffiliateRecord;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("affiliates")
      .update(affiliateToPayload(affiliate))
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ affiliate: rowToAffiliate(data) });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error, "Unable to update affiliate") }, { status: 500 });
  }
}
