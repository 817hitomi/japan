import type { Metadata } from "next";
import { createSupabaseReadClient } from "../../lib/supabase/server";
import { AffiliateRecord } from "./affiliateTypes";
import { rowToAffiliate, AffiliateRow } from "../api/affiliates/affiliateMapper";
import AffiliatesCarouselClient from "./AffiliatesCarouselClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "聯盟行銷 | JapanNote",
  description: "JapanNote 聯盟行銷推薦與導購頁。"
};

async function readPublishedAffiliates(): Promise<AffiliateRecord[]> {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase
      .from("affiliates")
      .select("*")
      .eq("status", "published")
      .order("published_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as AffiliateRow[]).map(rowToAffiliate);
  } catch {
    return [];
  }
}

export default async function AffiliatesPage() {
  const affiliates = await readPublishedAffiliates();
  return <AffiliatesCarouselClient initialAffiliates={affiliates} />;
}
