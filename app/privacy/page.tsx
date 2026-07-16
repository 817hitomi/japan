import type { Metadata } from "next";
import PolicyPageClient from "../PolicyPageClient";

export const metadata: Metadata = {
  title: "隱私權政策 | JapanNote",
  description: "JapanNote 隱私權政策，說明網站如何處理瀏覽、學習、分析與聯絡相關資料。"
};

const policySections = [
  {
    title: "一、適用範圍",
    body: [
      "本政策適用於 JapanNote 網站所提供的日文學習內容、單字卡、學習筆記、測驗或其他相關服務。",
      "當你瀏覽或使用本網站，即表示你理解本政策所說明的資料處理方式。"
    ]
  },
  {
    title: "二、我們可能收集的資料",
    body: [
      "網站可能會記錄基本瀏覽資訊，例如頁面瀏覽、裝置與瀏覽器資訊、來源網址、使用時間與大略互動紀錄，用於維護網站品質與理解內容成效。",
      "如果你透過網站功能主動提供資料，例如聯絡、回報錯誤或登入管理功能，我們會依照該功能目的處理你提供的內容。"
    ]
  },
  {
    title: "三、資料使用目的",
    body: [
      "我們使用資料來維護網站運作、改善學習內容、排查錯誤、統計頁面成效、避免濫用，以及回覆你主動提出的問題或回報。",
      "我們不會出售你的個人資料。"
    ]
  },
  {
    title: "四、Cookie 與分析工具",
    body: [
      "本網站可能使用 Cookie、localStorage 或類似技術保存基本狀態，例如瀏覽識別、互動紀錄或偏好設定。",
      "網站也可能使用分析或廣告相關工具，協助理解內容表現、維持服務與顯示合適的網站內容。第三方工具可能依其自身政策處理資料。"
    ]
  },
  {
    title: "五、Google AdSense 與廣告 Cookie",
    body: [
      "本網站可能使用 Google AdSense 或其他第三方廣告服務顯示廣告。",
      "Google 與其他第三方廣告供應商可能透過 Cookie，在使用者瀏覽本網站或其他網站後提供相關廣告。Google 使用廣告 Cookie，可依據使用者造訪本網站及網際網路上其他網站的紀錄，提供個人化或非個人化廣告。",
      "使用者可以透過 Google 的廣告設定管理或停用個人化廣告，也可以透過瀏覽器設定限制或刪除 Cookie。停用 Cookie 後，部分網站功能或廣告內容可能受到影響。"
    ]
  },
  {
    title: "六、第三方連結",
    body: [
      "本網站可能連到 YouTube、Facebook、Instagram、LINE 或其他外部網站。你離開 JapanNote 後，外部網站的資料處理方式不屬於本政策範圍。",
      "建議你在使用第三方服務前，閱讀該服務提供的隱私權政策。"
    ]
  },
  {
    title: "七、資料保存與安全",
    body: [
      "我們會在達成使用目的所需的期間內保存資料，並採取合理方式降低未授權存取、遺失、濫用或外洩風險。",
      "網路傳輸與儲存無法保證百分之百安全，但我們會以合理方式維護網站資料安全。"
    ]
  },
  {
    title: "八、你的權利",
    body: [
      "如果你曾主動提供個人資料，可以聯絡我們請求查詢、更正或刪除相關資料；我們會在合理範圍內協助處理。",
      "若資料因法律、資安、爭議處理或網站維護需要而必須保存，我們可能無法立即刪除全部紀錄。"
    ]
  },
  {
    title: "九、政策更新",
    body: [
      "本政策可能因網站功能、法規或服務調整而更新。更新後的內容會公布於本頁面。",
      "最後更新日期：2026 年 7 月 16 日。"
    ]
  }
];

export default function PrivacyPage() {
  return (
    <PolicyPageClient
      title="隱私權政策"
      kicker="Privacy Policy"
      description="這份政策說明 JapanNote 如何處理網站瀏覽、學習內容、分析與你主動提供的資料。"
      sections={policySections}
      ariaLabel="隱私權政策內容"
    />
  );
}
