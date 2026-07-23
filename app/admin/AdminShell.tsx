"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./notes/AdminNotes.module.scss";

const navItems = [
  { label: "總覽", href: "/admin" },
  { label: "單字卡", href: "/admin/words" },
  { label: "模擬測驗", href: "/admin/quiz?level=N5&category=文字．語彙" },
  { label: "學習筆記", href: "/admin/notes" },
  { label: "勘誤回報", href: "/admin/reports" },
  { label: "通路管理", href: "/admin/settings" },
  { label: "聯盟管理", href: "/admin/affiliates" },
  { label: "首頁白版", href: "/admin/quotes" },
  { label: "設定", href: "/admin/settings" }
];

function Sidebar() {
  const pathname = usePathname();
  const isQuizActive = pathname.startsWith("/admin/quiz");
  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandMark}>
        <Image src="/brand/logo.png" alt="" width={86} height={86} priority />
      </div>
      <div className={styles.badge}>
        <span className={styles.playIcon}>▶</span>
        <span>JapanNote</span>
      </div>
      <nav className={styles.sideNav} aria-label="後台功能">
        {navItems.map((item, index) => (
          <div className={styles.sideNavGroup} key={item.label}>
            <Link href={item.href} prefetch={false} className={index === activeIndex ? styles.active : undefined}>
              {item.label}
            </Link>
            {item.label === "模擬測驗" && isQuizActive ? (
              <Link className={styles.subNavItem} href="/admin/quiz?level=N5&category=文字．語彙" prefetch={false}>
                N5
              </Link>
            ) : null}
          </div>
        ))}
      </nav>
      <button className={styles.logoutButton} type="button">
        登出
      </button>
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.adminPage}>
      <header className={styles.topbar}>
        <Link href="/">回前台</Link>
        <strong>後台管理</strong>
      </header>
      <div className={styles.adminBody}>
        <Sidebar />
        <section className={styles.workspace}>{children}</section>
      </div>
    </main>
  );
}
