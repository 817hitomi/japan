import type { Metadata } from "next";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";
import { readLearningOverviewForPublicPage } from "../../publicData";
import homeStyles from "../../page.module.scss";
import SongPlayerClient from "./SongPlayerClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "小さな夢｜同步歌詞試作｜JapanNote",
  description: "跟著影片逐句閱讀日文歌詞、假名與繁體中文翻譯。"
};

export default async function ChiisanaYumePage() {
  const learningOverview = await readLearningOverviewForPublicPage();

  return (
    <main className={homeStyles.page}>
      <SiteHeader />
      <SongPlayerClient learningDays={learningOverview.learningDays} />
      <SiteFooter />
    </main>
  );
}
