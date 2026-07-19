"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import SiteFooter from "./SiteFooter";
import homeStyles from "./page.module.scss";
import styles from "./PolicyPage.module.scss";

type PolicySection = {
  title: string;
  body: string[];
};

type PolicyPageClientProps = {
  title: string;
  kicker: string;
  description: string;
  sections: PolicySection[];
  ariaLabel: string;
};

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "/quiz", children: [{ label: "文字．語彙", href: "/quiz/vocabulary" }] },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const parallaxBalls = [
  { className: homeStyles.ballTopLeft, y: -0.1, x: 0.035 },
  { className: homeStyles.ballHeroRight, y: 0.08, x: -0.03 },
  { className: homeStyles.ballLeftLarge, y: -0.16, x: 0.055 },
  { className: homeStyles.ballHeroPink, y: 0.12, x: -0.05 },
  { className: homeStyles.ballArticleTop, y: 0.18, x: -0.07 },
  { className: homeStyles.ballSideGreen, y: -0.14, x: 0.06 },
  { className: homeStyles.ballContent, y: 0.11, x: 0.04 },
  { className: homeStyles.ballBottomLeft, y: -0.2, x: 0.075 },
  { className: homeStyles.ballBottomPink, y: 0.16, x: -0.065 },
  { className: homeStyles.ballFooterGold, y: -0.12, x: 0.05 },
  { className: homeStyles.ballFooterGreen, y: 0.14, x: -0.055 }
];

function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      setScrollY(window.scrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`${homeStyles.parallax} ${styles.policyParallax}`} aria-hidden="true">
      {parallaxBalls.map((ball, index) => (
        <span
          key={ball.className}
          className={`${homeStyles.ball} ${ball.className}`}
          style={{
            transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)`
          }}
        />
      ))}
    </div>
  );
}

export default function PolicyPageClient({ title, kicker, description, sections, ariaLabel }: PolicyPageClientProps) {
  return (
    <main className={`${homeStyles.page} ${styles.policyPage}`}>
      <ParallaxBackground />

      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <a className={homeStyles.logoMark} href="/" aria-label="JapanNote">
            <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
          </a>
          <a
            className={homeStyles.badge}
            href="https://www.youtube.com/@japanNote"
            aria-label="JapanNote YouTube"
            target="_blank"
            rel="noreferrer"
          >
            <Image src="/brand/japannote-badge.png" alt="JapanNote" width={204} height={47} priority />
          </a>
          <nav className={homeStyles.nav} aria-label="主要選單">
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
        <p className={styles.kicker}>{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className={styles.policyBody} aria-label={ariaLabel}>
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </article>
        ))}
      </section>

      <SiteFooter />
    </main>
  );
}
