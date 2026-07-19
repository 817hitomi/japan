"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import SiteFooter from "../SiteFooter";
import { readAffiliatesWithSource } from "./affiliateStorage";
import { AffiliateRecord, getAffiliateTags } from "./affiliateTypes";
import homeStyles from "../page.module.scss";
import styles from "./AffiliatesPage.module.scss";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "/quiz", children: [{ label: "文字．語彙", href: "/quiz/vocabulary" }] },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

function AffiliateCard({ affiliate }: { affiliate: AffiliateRecord }) {
  const tags = getAffiliateTags(affiliate.tags);
  const card = (
    <article className={styles.card}>
      <div className={styles.cover}>
        {affiliate.imageUrl ? <img src={affiliate.imageUrl} alt="" /> : <div className={styles.coverFallback}>{affiliate.category}</div>}
        <span>{affiliate.category}</span>
      </div>
      <div className={styles.cardBody}>
        <h2>{affiliate.title}</h2>
        <p>{affiliate.summary}</p>
        {tags.length > 0 ? (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <strong key={tag}>#{tag}</strong>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );

  if (!affiliate.linkUrl) {
    return card;
  }

  return (
    <a className={styles.cardLink} href={affiliate.linkUrl} target="_blank" rel="noreferrer">
      {card}
    </a>
  );
}

export default function AffiliatesPageClient({ initialAffiliates }: { initialAffiliates: AffiliateRecord[] }) {
  const [affiliates, setAffiliates] = useState<AffiliateRecord[]>(initialAffiliates);
  const [category, setCategory] = useState("全部");

  useEffect(() => {
    let active = true;

    async function loadAffiliates() {
      const result = await readAffiliatesWithSource("published");
      if (active && result.affiliates.length > 0) {
        setAffiliates(result.affiliates);
      }
    }

    loadAffiliates();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => ["全部", ...Array.from(new Set(affiliates.map((item) => item.category).filter(Boolean)))], [affiliates]);
  const visibleAffiliates = category === "全部" ? affiliates : affiliates.filter((item) => item.category === category);

  return (
    <main className={homeStyles.page}>
      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <a className={homeStyles.logoMark} href="/" aria-label="JapanNote">
            <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
          </a>
          <a className={homeStyles.badge} href="https://www.youtube.com/@japanNote" aria-label="JapanNote YouTube" target="_blank" rel="noreferrer">
            <Image src="/brand/japannote-badge.png" alt="JapanNote" width={204} height={47} priority />
          </a>
          <nav className={homeStyles.nav} aria-label="主選單">
            {navItems.map((item) => (
              <div className={homeStyles.navItem} key={item.label}>
                <a className={item.children ? homeStyles.navParent : undefined} href={item.href}>
                  {item.label}
                </a>
                {item.children ? (
                  <div className={homeStyles.subNav} aria-label={`${item.label}子選單`}>
                    {item.children.map((child) => (
                      <a key={child.label} href={child.href}>
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>聯盟行銷</h1>
      </section>

      <section className={styles.content}>
        <div className={styles.searchTitle}>
          <h2>搜尋列表</h2>
        </div>

        {categories.length > 1 ? (
          <div className={styles.filters} aria-label="分類篩選">
            {categories.map((item) => (
              <button className={item === category ? styles.currentFilter : undefined} type="button" key={item} onClick={() => setCategory(item)}>
                {item}
              </button>
            ))}
          </div>
        ) : null}

        {visibleAffiliates.length > 0 ? (
          <div className={styles.grid}>
            {visibleAffiliates.map((affiliate) => (
              <AffiliateCard affiliate={affiliate} key={affiliate.id} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>目前尚未發布聯盟行銷內容。</p>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
