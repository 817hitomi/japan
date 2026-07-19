"use client";

import Image from "next/image";
import styles from "./page.module.scss";

type NavItem = {
  label: string;
  href: string;
  children?: {
    label: string;
    href: string;
  }[];
};

const navItems: NavItem[] = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "/quiz", children: [{ label: "文字．語彙", href: "/quiz/vocabulary" }] },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

export default function SiteHeader({ activeLabel }: { activeLabel?: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.logoMark} href="/" aria-label="JapanNote">
          <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
        </a>
        <a className={styles.badge} href="https://www.youtube.com/@japanNote" aria-label="JapanNote YouTube" target="_blank" rel="noreferrer">
          <Image src="/brand/japannote-badge.png" alt="JapanNote" width={204} height={47} priority />
        </a>
        <nav className={styles.nav} aria-label="主要選單">
          {navItems.map((item) => (
            <div className={styles.navItem} key={item.label}>
              <a className={`${item.children ? styles.navParent : ""} ${activeLabel === item.label ? styles.activeNav : ""}`} href={item.href}>
                {item.label}
              </a>
              {item.children ? (
                <div className={styles.subNav} aria-label={`${item.label}子選單`}>
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
  );
}
