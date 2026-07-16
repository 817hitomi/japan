import type { CSSProperties } from "react";
import Image from "next/image";
import styles from "./page.module.scss";

const footerGroups = [
  {
    title: "關於日文筆記",
    links: [
      { label: "關於筆記", href: "/about" },
      { label: "內容勘誤回報", href: "#" }
    ]
  },
  {
    title: "學習日文",
    links: [
      { label: "N5 單字", href: "/words" },
      { label: "模擬測驗", href: "#" },
      { label: "日文筆記", href: "/notes" }
    ]
  },
  {
    title: "網站政策",
    links: [
      { label: "隱私權政策", href: "/privacy" },
      { label: "Cookie 政策", href: "/cookies" },
      { label: "使用條款", href: "/terms" },
      { label: "免責聲明", href: "/disclaimer" }
    ]
  }
];

const socialLinks = [
  { label: "Facebook", color: "#1877f2", href: "https://facebook.com/17japanNote" },
  { label: "Instagram", color: "#e4405f", href: "#" },
  { label: "LINE", color: "#06c755", href: "#" }
];

function SocialIcon({ label }: { label: string }) {
  if (label === "Instagram") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect x="5" y="5" width="14" height="14" rx="4" fill="none" />
        <circle cx="12" cy="12" r="3.2" fill="none" />
        <circle cx="16.6" cy="7.4" r="1" />
      </svg>
    );
  }

  if (label === "LINE") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 4.5c-4.4 0-8 2.75-8 6.14 0 3.04 2.72 5.58 6.4 6.06.25.05.58.16.66.38.08.2.05.52.02.72l-.11.68c-.03.2-.16.8.7.44.86-.36 4.64-2.73 6.33-4.68A5.32 5.32 0 0 0 20 10.64C20 7.25 16.4 4.5 12 4.5Z" />
        <path d="M8.25 9.1v3.02h1.9m.86-3.02v3.02m1.05 0V9.1l2.02 3.02V9.1m1.1 0h1.9m-1.9 1.5h1.64m-1.64 1.52h1.9" fill="none" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M13.7 20v-7.28h2.45l.37-2.84H13.7V8.06c0-.82.23-1.38 1.4-1.38h1.5V4.14A20.18 20.18 0 0 0 14.42 4c-2.16 0-3.64 1.32-3.64 3.75v2.13H8.34v2.84h2.44V20h2.92Z" />
    </svg>
  );
}

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <Image src="/brand/logo.png" alt="" width={72} height={72} />
        <nav className={styles.footerNav} aria-label="頁尾導覽">
          {footerGroups.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </section>
          ))}
        </nav>
        <section className={styles.footerSocial} aria-label="追蹤我們">
          <h2 className={styles.footerSocialTitle}>追蹤我們</h2>
          <div className={styles.footerLinks}>
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ "--social-color": link.color } as CSSProperties}
                aria-label={link.label}
                title={link.label}
                target={link.href === "#" ? undefined : "_blank"}
                rel={link.href === "#" ? undefined : "noreferrer"}
              >
                <SocialIcon label={link.label} />
              </a>
            ))}
          </div>
        </section>
        <p className={styles.footerTagline}>
          給不喜歡死背，也想慢慢學會日文的人
          <br />
          透過單字、例句、文法與練習，每天學習一點點
        </p>
      </div>
      <p className={styles.footerCopyright}>Copyright © 2026 by japanNote All Rights Reserved</p>
    </footer>
  );
}
