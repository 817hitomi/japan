export type AdSlotId = "top-banner" | "article-mid" | "article-bottom" | "sidebar-square";

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
      label: matched?.label || defaultSetting.label,
      enabled: Boolean(matched?.enabled),
      channel: matched?.channel === "html" ? "html" : "affiliate",
      linkUrl: matched?.linkUrl ?? "",
      imageUrl: matched?.imageUrl ?? "",
      altText: matched?.altText || defaultSetting.altText,
      htmlCode: matched?.htmlCode ?? ""
    };
  });
}

export function getAdSlotFromLabel(label?: string): AdSlotId {
  if (label === "文章結尾廣告") {
    return "article-bottom";
  }

  return "article-mid";
}
