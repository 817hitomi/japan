export type AdSlotId = "global-head" | "top-banner" | "article-mid" | "article-bottom" | "sidebar-square";

export type AdChannel = "affiliate" | "html";

export type AdSetting = {
  slot: AdSlotId;
  label: string;
  enabled: boolean;
  channel: AdChannel;
  linkUrl: string;
  imageUrl: string;
  altText: string;
  htmlCode: string;
};

export const defaultAdSettings: AdSetting[] = [
  {
    slot: "global-head",
    label: "全站 AdSense 驗證碼",
    enabled: true,
    channel: "html",
    linkUrl: "",
    imageUrl: "",
    altText: "JapanNote AdSense",
    htmlCode:
      '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9349912323064571" crossorigin="anonymous"></script>'
  },
  {
    slot: "top-banner",
    label: "頁首橫幅",
    enabled: false,
    channel: "affiliate",
    linkUrl: "",
    imageUrl: "",
    altText: "JapanNote 廣告",
    htmlCode: ""
  },
  {
    slot: "article-mid",
    label: "文章中段廣告",
    enabled: false,
    channel: "affiliate",
    linkUrl: "",
    imageUrl: "",
    altText: "JapanNote 廣告",
    htmlCode: ""
  },
  {
    slot: "article-bottom",
    label: "文章結尾廣告",
    enabled: false,
    channel: "affiliate",
    linkUrl: "",
    imageUrl: "",
    altText: "JapanNote 廣告",
    htmlCode: ""
  },
  {
    slot: "sidebar-square",
    label: "側欄方形廣告",
    enabled: false,
    channel: "affiliate",
    linkUrl: "",
    imageUrl: "",
    altText: "JapanNote 廣告",
    htmlCode: ""
  }
];

export function normalizeAdSettings(settings: Partial<AdSetting>[] | unknown): AdSetting[] {
  const source = Array.isArray(settings) ? settings : [];

  return defaultAdSettings.map((defaultSetting) => {
    const matched = source.find((item) => {
      const setting = item as Partial<AdSetting>;
      return setting.slot === defaultSetting.slot;
    }) as Partial<AdSetting> | undefined;

    return {
      ...defaultSetting,
      ...matched,
      slot: defaultSetting.slot,
      label: defaultSetting.label,
      enabled: matched?.enabled ?? defaultSetting.enabled,
      channel: defaultSetting.slot === "global-head" ? "html" : matched?.channel === "html" ? "html" : "affiliate",
      linkUrl: matched?.linkUrl ?? "",
      imageUrl: matched?.imageUrl ?? "",
      altText: matched?.altText || defaultSetting.altText,
      htmlCode: defaultSetting.slot === "global-head" && !matched?.htmlCode ? defaultSetting.htmlCode : matched?.htmlCode ?? ""
    };
  });
}

export function getAdSlotFromLabel(label?: string): AdSlotId {
  if (label === "文章結尾廣告") {
    return "article-bottom";
  }

  return "article-mid";
}
