"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import SiteFooter from "../SiteFooter";
import homeStyles from "../page.module.scss";
import styles from "./About.module.scss";

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

const values = [
  {
    title: "不急著背完",
    text: "把日文拆成每天能讀懂、能複習的一小段，讓學習不要只靠硬撐。"
  },
  {
    title: "保留讀法",
    text: "單字、例句與筆記盡量保留假名或振假名，讓初學者不會卡在看不懂漢字。"
  },
  {
    title: "從生活開始",
    text: "用日常句子、情境短文與實用文法，把課本上的規則接回真實使用。"
  }
];

const sections = [
  "N5 單字與讀音整理",
  "日文例句、中文理解與文法提醒",
  "學習筆記、短文與複習材料",
  "適合自學者慢慢累積的練習節奏"
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
    <div className={`${homeStyles.parallax} ${styles.aboutParallax}`} aria-hidden="true">
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

export default function AboutClient() {
  return (
    <main className={`${homeStyles.page} ${styles.aboutPage}`}>
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
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>About JapanNote</p>
          <h1>關於日文筆記</h1>
          <p>
            JapanNote 是一個給日文初學者的自學筆記站。這裡整理單字、例句、文法與短篇練習，
            希望讓「每天學一點」變成真的做得到。
          </p>
        </div>
        <div className={styles.heroArt} aria-hidden="true">
          <div className={styles.dotGrid} />
          <Image src="/brand/02.png" alt="" width={512} height={512} priority />
        </div>
      </section>

      <section className={styles.intro} aria-labelledby="about-intro-title">
        <div>
          <p className={styles.kicker}>Why</p>
          <h2 id="about-intro-title">給不喜歡死背的人</h2>
        </div>
        <p>
          學日文常常不是不努力，而是內容太快、讀法不清楚、複習沒有路線。JapanNote 想把學習材料整理成比較好入口的形式：
          看得到假名、讀得到句子，也知道這句話大概可以怎麼用。
        </p>
      </section>

      <section className={styles.valueGrid} aria-label="內容特色">
        {values.map((value) => (
          <article key={value.title}>
            <h2>{value.title}</h2>
            <p>{value.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.notePanel} aria-labelledby="about-content-title">
        <div>
          <p className={styles.kicker}>What You Can Find</p>
          <h2 id="about-content-title">這裡會放什麼</h2>
          <p>
            內容會以初學者可以跟上的速度累積，從單字卡、筆記到短文練習，慢慢把日文變成每天都能碰一下的東西。
          </p>
        </div>
        <ul>
          {sections.map((section) => (
            <li key={section}>{section}</li>
          ))}
        </ul>
      </section>

      <SiteFooter />
    </main>
  );
}
