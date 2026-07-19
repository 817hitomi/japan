import { unstable_cache } from "next/cache";
import { createRequestTimer } from "../../lib/requestDiagnostics";
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

async function readGlobalHeadAdHtml() {
  try {
    const supabase = createSupabaseReadClient();
    const timer = createRequestTimer("database query", { table: "site_ads", operation: "global-head-ad" });
    const { data, error } = await supabase
      .from("site_ads")
      .select("slot,label,enabled,channel,link_url,image_url,alt_text,html_code")
      .eq("slot", "global-head")
      .maybeSingle();

    if (error) {
      timer.end({ status: "error" });
      throw error;
    }

    timer.end({ status: "ok", rows: data ? 1 : 0 });
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

export const getGlobalHeadAdHtml = unstable_cache(readGlobalHeadAdHtml, ["global-head-ad-html"], {
  revalidate: 300
});
