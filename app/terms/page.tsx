import type { Metadata } from "next";
import PolicyPageClient from "../PolicyPageClient";

export const metadata: Metadata = {
  title: "使用條款 | JapanNote",
  description: "JapanNote 使用條款，說明網站內容、使用限制、智慧財產權與責任範圍。"
};

const termsSections = [
  {
    title: "一、接受條款",
    body: [
      "當你瀏覽或使用 JapanNote，即表示你已閱讀並同意本使用條款。",
      "如果你不同意本條款，請停止使用本網站。"
    ]
  },
  {
    title: "二、網站內容",
    body: [
      "JapanNote 提供日文學習相關內容，包括單字、例句、文法筆記、短文練習、測驗或其他學習材料。",
      "我們會盡力維持內容正確與可讀性，但學習內容可能仍有錯誤、疏漏或更新延遲。"
    ]
  },
  {
    title: "三、使用限制",
    body: [
      "你不得以任何方式攻擊、干擾、濫用本網站，或嘗試未經授權存取系統、資料庫、管理介面或其他使用者資料。",
      "你不得將本網站內容用於違法、侵權、詐欺、惡意自動化、大量抓取或其他不當用途。"
    ]
  },
  {
    title: "四、智慧財產權",
    body: [
      "本網站上的文字、版面、圖片、標誌、設計與整理內容，除另有標示外，均由 JapanNote 或合法權利人擁有或授權使用。",
      "未經同意，不得大量複製、重製、改作、轉售或以其他方式作為商業用途。"
    ]
  },
  {
    title: "五、第三方連結與服務",
    body: [
      "本網站可能提供外部網站、社群平台、影片平台或第三方服務連結。",
      "第三方網站的內容、政策、服務品質與資料處理方式，均由該第三方自行負責。"
    ]
  },
  {
    title: "六、服務變更與中止",
    body: [
      "JapanNote 可能依需要調整、暫停或中止部分功能、內容或服務，恕不保證網站永遠不中斷或錯誤皆能立即修復。",
      "我們也可能因維護、安全、法規或營運需求修改本條款。"
    ]
  },
  {
    title: "七、責任限制",
    body: [
      "你應自行判斷學習內容的適用性。本網站不保證內容能符合所有學習目標、考試需求或個人情境。",
      "因使用或無法使用本網站而造成的任何直接或間接損失，JapanNote 在法律允許範圍內不負擔責任。"
    ]
  },
  {
    title: "八、條款更新",
    body: [
      "本條款可能不定期更新。更新後的內容會公布於本頁面，並自公布時起生效。",
      "最後更新日期：2026 年 7 月 16 日。"
    ]
  }
];

export default function TermsPage() {
  return (
    <PolicyPageClient
      title="使用條款"
      kicker="Terms of Use"
      description="這份條款說明使用 JapanNote 時需要理解的內容範圍、使用限制與責任邊界。"
      sections={termsSections}
      ariaLabel="使用條款內容"
    />
  );
}
