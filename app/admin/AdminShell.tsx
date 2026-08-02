"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { QuizLevel, quizLevels } from "../quiz/quizTypes";
import styles from "./notes/AdminNotes.module.scss";

const navItems = [
  { label: "總覽", href: "/admin" },
  { label: "單字卡", href: "/admin/words" },
  { label: "模擬測驗", href: "/admin/quiz?level=N5" },
  { label: "學習筆記", href: "/admin/notes" },
  { label: "歌曲頁面", href: "/admin/songs" },
  { label: "勘誤回報", href: "/admin/reports" },
  { label: "通路管理", href: "/admin/settings" },
  { label: "聯盟管理", href: "/admin/affiliates" },
  { label: "首頁白版", href: "/admin/quotes" },
  { label: "設定", href: "/admin/settings" }
];

const sidebarQuizLevels: QuizLevel[] = ["N5", "N4", "N3"];

function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isQuizActive = pathname.startsWith("/admin/quiz");
  const requestedQuizLevel = searchParams.get("level");
  const activeQuizLevel: QuizLevel = quizLevels.includes(requestedQuizLevel as QuizLevel)
    ? (requestedQuizLevel as QuizLevel)
    : "N5";

  const activeIndex = navItems.findIndex(
    (item) => {
      const itemPathname = item.href.split("?")[0];
      return pathname === itemPathname || (itemPathname !== "/admin" && pathname.startsWith(`${itemPathname}/`));
    }
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
            <Link
              href={item.href}
              prefetch={false}
              className={index === activeIndex ? styles.active : undefined}
            >
              {item.label}
            </Link>
            {item.label === "模擬測驗" && isQuizActive ? (
              <div className={styles.quizLevelTree} aria-label="測驗級別">
                {sidebarQuizLevels.map((level) => (
                  <Link
                    className={`${styles.quizLevelLink} ${
                      level === activeQuizLevel ? styles.quizLevelLinkActive : ""
                    }`}
                    href={`/admin/quiz?level=${level}`}
                    prefetch={false}
                    key={level}
                    aria-current={level === activeQuizLevel ? "page" : undefined}
                  >
                    {level}
                  </Link>
                ))}
              </div>
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
