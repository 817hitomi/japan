import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseReadClient } from "../../lib/supabase/server";
import { AdSetting, normalizeAdSettings } from "./adTypes";

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

export async function getGlobalHeadAdHtml() {
  noStore();

  try {
    const supabase = createSupabaseReadClient();
    const { data, error } = await supabase.from("site_ads").select("*").eq("slot", "global-head").maybeSingle();

    if (error) {
      throw error;
    }

    const [setting] = normalizeAdSettings(data ? [rowToAd(data)] : []);

    if (setting?.enabled && setting.channel === "html") {
      return setting.htmlCode.trim();
    }
  } catch {
    const [setting] = normalizeAdSettings([]);

    if (setting?.enabled && setting.channel === "html") {
      return setting.htmlCode.trim();
    }
  }

  return "";
}
