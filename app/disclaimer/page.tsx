import type { Metadata } from "next";
import PolicyPageClient from "../PolicyPageClient";

export const metadata: Metadata = {
  title: "免責聲明 | JapanNote",
  description: "JapanNote 免責聲明，說明日文學習內容、外部連結、廣告與網站使用風險。"
};

const disclaimerSections = [
  {
    title: "一、學習內容性質",
    body: [
      "JapanNote 提供的單字、例句、文法、筆記與測驗內容，主要作為日文自學與複習參考。",
      "內容不構成任何升學、考試、翻譯、職涯、法律或其他專業保證。"
    ]
  },
  {
    title: "二、內容正確性",
    body: [
      "我們會盡力維持內容正確、清楚與適合初學者閱讀，但仍可能出現錯字、翻譯偏差、語境不完整或資料更新延遲。",
      "如果你發現內容需要修正，歡迎透過網站提供的方式回報。"
    ]
  },
  {
    title: "三、個人判斷與使用風險",
    body: [
      "你應依照自己的學習程度、需求與情境判斷是否採用本網站內容。",
      "因依賴本網站內容而造成的學習落差、考試結果、翻譯錯誤或其他損失，JapanNote 在法律允許範圍內不負擔責任。"
    ]
  },
  {
    title: "四、外部連結",
    body: [
      "本網站可能連到 YouTube、社群平台、廣告頁面或其他第三方網站。",
      "第三方網站的內容、服務、交易、資料處理與安全性，均由該第三方自行負責。"
    ]
  },
  {
    title: "五、廣告與合作內容",
    body: [
      "本網站可能顯示廣告、推薦連結或合作內容。相關商品、服務或外部頁面的品質與承諾，應以提供者公告為準。",
      "你在第三方網站進行任何交易或互動前，應自行確認條件與風險。"
    ]
  },
  {
    title: "六、網站可用性",
    body: [
      "JapanNote 不保證網站永遠不中斷、沒有錯誤、沒有安全風險，或所有內容都會永久保存。",
      "我們可能因維護、更新、安全或營運需求調整、中止或刪除部分內容與功能。"
    ]
  },
  {
    title: "七、聲明更新",
    body: [
      "本免責聲明可能依網站功能、內容或法規需求調整。更新後的內容會公布於本頁面。",
      "最後更新日期：2026 年 7 月 16 日。"
    ]
  }
];

export default function DisclaimerPage() {
  return (
    <PolicyPageClient
      title="免責聲明"
      kicker="Disclaimer"
      description="這份聲明說明 JapanNote 學習內容、外部連結、廣告與網站使用上的責任邊界。"
      sections={disclaimerSections}
      ariaLabel="免責聲明內容"
    />
  );
}
