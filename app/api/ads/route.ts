import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseReadClient } from "../../../lib/supabase/server";
import { AdSetting, defaultAdSettings, normalizeAdSettings } from "../../ads/adTypes";

type SiteAdRow = {
  slot: string;
  label: string | null;
  enabled: boolean | null;
  channel: string | null;
  link_url: string | null;
  image_url: string | null;
  alt_text: string | null;
  html_code: string | null;
};

function rowToAd(row: SiteAdRow): Partial<AdSetting> {
  return {
    slot: row.slot as AdSetting["slot"],
    label: row.label ?? "",
    enabled: Boolean(row.enabled),
    channel: row.channel === "html" ? "html" : "affiliate",
    linkUrl: row.link_url ?? "",
    imageUrl: row.image_url ?? "",
    altText: row.alt_text ?? "",
    htmlCode: row.html_code ?? ""
  };
}

function adToRow(setting: AdSetting) {
  return {
    slot: setting.slot,
    label: setting.label,
    enabled: setting.enabled,
    channel: setting.channel,
    link_url: setting.linkUrl,
    image_url: setting.imageUrl,
    alt_text: setting.altText,
    html_code: setting.htmlCode
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase.from("site_ads").select("*").order("slot", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ads: normalizeAdSettings((data ?? []).map(rowToAd)) });
  } catch {
    return NextResponse.json({ ads: defaultAdSettings });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { ads?: AdSetting[] };
    const ads = normalizeAdSettings(body.ads);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("site_ads").upsert(ads.map(adToRow), { onConflict: "slot" }).select("*");

    if (error) {
      throw error;
    }

    return NextResponse.json({ ads: normalizeAdSettings((data ?? []).map(rowToAd)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save ads" }, { status: 500 });
  }
}
