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
  { label: "模擬測驗", href: "#" },
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

export default function AffiliatesCarouselClient({ initialAffiliates }: { initialAffiliates: AffiliateRecord[] }) {
  const [affiliates, setAffiliates] = useState<AffiliateRecord[]>(initialAffiliates);
  const [category, setCategory] = useState("全部");
  const [currentSlide, setCurrentSlide] = useState(0);

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
  const carouselItems = visibleAffiliates.length > 0 ? visibleAffiliates : affiliates;
  const activeSlide = carouselItems[currentSlide] ?? carouselItems[0];

  useEffect(() => {
    setCurrentSlide(0);
  }, [category, affiliates.length]);

  useEffect(() => {
    if (carouselItems.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentSlide((current) => (current + 1) % carouselItems.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [carouselItems.length]);

  function goToSlide(nextIndex: number) {
    if (carouselItems.length === 0) {
      return;
    }

    setCurrentSlide((nextIndex + carouselItems.length) % carouselItems.length);
  }

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
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <h1>輪播</h1>
      </section>

      <section className={styles.content}>
        <section className={styles.carousel} aria-label="聯盟行銷輪播">
          {activeSlide ? (
            <>
              <button className={`${styles.carouselButton} ${styles.prevButton}`} type="button" onClick={() => goToSlide(currentSlide - 1)} aria-label="上一張">
                ‹
              </button>
              <a
                className={styles.carouselStage}
                href={activeSlide.linkUrl || "#"}
                target={activeSlide.linkUrl ? "_blank" : undefined}
                rel={activeSlide.linkUrl ? "noreferrer" : undefined}
              >
                <div className={styles.carouselImage}>
                  {activeSlide.imageUrl ? <img src={activeSlide.imageUrl} alt="" /> : <span>{activeSlide.category}</span>}
                </div>
                <div className={styles.carouselCopy}>
                  <span>{activeSlide.category}</span>
                  <h2>{activeSlide.title}</h2>
                  <p>{activeSlide.summary}</p>
                </div>
              </a>
              <button className={`${styles.carouselButton} ${styles.nextButton}`} type="button" onClick={() => goToSlide(currentSlide + 1)} aria-label="下一張">
                ›
              </button>
              <div className={styles.dots} aria-label="輪播切換">
                {carouselItems.map((item, index) => (
                  <button
                    className={index === currentSlide ? styles.currentDot : undefined}
                    type="button"
                    key={item.id}
                    onClick={() => goToSlide(index)}
                    aria-label={`切換到第 ${index + 1} 張`}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className={styles.carouselEmpty}>目前尚未發布聯盟行銷輪播內容。</div>
          )}
        </section>

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
