import type { Metadata } from "next";
import PolicyPageClient from "../PolicyPageClient";

export const metadata: Metadata = {
  title: "Cookie 政策 | JapanNote",
  description: "JapanNote Cookie 政策，說明網站如何使用 Cookie、localStorage 與類似技術。"
};

const cookieSections = [
  {
    title: "一、Cookie 是什麼",
    body: [
      "Cookie 是網站儲存在你裝置中的小型資料，localStorage 或類似技術也可能用來保存網站狀態。",
      "這些技術可以協助網站記住基本設定、維持功能運作，並理解內容使用情況。"
    ]
  },
  {
    title: "二、我們使用 Cookie 的目的",
    body: [
      "JapanNote 可能使用 Cookie 或類似技術記錄瀏覽識別、頁面互動、功能偏好與基本統計資料。",
      "這些資料主要用於維護網站、改善學習內容、排查錯誤、統計頁面成效，以及提供更穩定的使用體驗。"
    ]
  },
  {
    title: "三、必要性與分析性 Cookie",
    body: [
      "必要性 Cookie 或本機儲存資料用於維持網站基本功能，例如辨識瀏覽狀態或保存操作需要的資料。",
      "分析性 Cookie 或相關工具則用於了解哪些內容較常被瀏覽、網站是否發生錯誤，以及使用者大致如何與頁面互動。"
    ]
  },
  {
    title: "四、第三方工具",
    body: [
      "本網站可能嵌入或連結第三方服務，例如 YouTube、Facebook、Instagram、LINE、廣告或分析工具。",
      "第三方服務可能依其自身政策使用 Cookie 或類似技術；你可以前往該服務的隱私權或 Cookie 政策了解更多。"
    ]
  },
  {
    title: "五、如何管理 Cookie",
    body: [
      "你可以透過瀏覽器設定封鎖、刪除或限制 Cookie，也可以清除 localStorage 等本機資料。",
      "如果停用部分 Cookie 或本機儲存功能，網站某些功能可能無法正常記錄狀態或提供完整體驗。"
    ]
  },
  {
    title: "六、政策更新",
    body: [
      "本政策可能因網站功能、分析工具或第三方服務調整而更新。更新後的內容會公布於本頁面。",
      "最後更新日期：2026 年 7 月 16 日。"
    ]
  }
];

export default function CookiesPage() {
  return (
    <PolicyPageClient
      title="Cookie 政策"
      kicker="Cookie Policy"
      description="這份政策說明 JapanNote 如何使用 Cookie、localStorage 與類似技術維持網站功能與改善內容。"
      sections={cookieSections}
      ariaLabel="Cookie 政策內容"
    />
  );
}
