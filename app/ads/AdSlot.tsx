"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdSetting, AdSlotId } from "./adTypes";
import { readAdsWithFallback } from "./adStorage";

type AdSlotProps = {
  slot: AdSlotId;
  className: string;
  fallbackLabel?: string;
};

function renderPlaceholder(label: string) {
  return <span>{label}</span>;
}

export default function AdSlot({ slot, className, fallbackLabel = "AD 廣告" }: AdSlotProps) {
  const [ads, setAds] = useState<AdSetting[]>([]);
  const htmlRef = useRef<HTMLDivElement | null>(null);
  const setting = useMemo(() => ads.find((item) => item.slot === slot), [ads, slot]);

  useEffect(() => {
    let active = true;

    readAdsWithFallback().then((nextAds) => {
      if (active) {
        setAds(nextAds);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const container = htmlRef.current;
    if (!container || setting?.channel !== "html" || !setting.htmlCode.trim()) {
      return;
    }

    const scripts = Array.from(container.querySelectorAll("script"));

    scripts.forEach((script) => {
      const nextScript = document.createElement("script");

      Array.from(script.attributes).forEach((attribute) => {
        nextScript.setAttribute(attribute.name, attribute.value);
      });

      nextScript.text = script.text;
      script.replaceWith(nextScript);
    });
  }, [setting]);

  if (!setting?.enabled) {
    return <section className={className}>{renderPlaceholder(fallbackLabel)}</section>;
  }

  if (setting.channel === "html" && setting.htmlCode.trim()) {
    return (
      <section className={className}>
        <div ref={htmlRef} dangerouslySetInnerHTML={{ __html: setting.htmlCode }} />
      </section>
    );
  }

  if (setting.linkUrl.trim() && setting.imageUrl.trim()) {
    return (
      <section className={className}>
        <a href={setting.linkUrl} target="_blank" rel="sponsored noopener noreferrer">
          <img src={setting.imageUrl} alt={setting.altText || setting.label} />
        </a>
      </section>
    );
  }

  return <section className={className}>{renderPlaceholder(fallbackLabel)}</section>;
}
