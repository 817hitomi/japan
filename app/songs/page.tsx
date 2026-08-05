import type { Metadata } from "next";
import { readLearningOverviewForPublicPage } from "../publicData";
import SongsListClient from "./SongsListClient";
import { readPublishedSongList } from "./songData";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "日文留音室 | JapanNote",
  description: "用日文歌曲、同步歌詞與學習筆記，留下每一次聽見日文的時刻。"
};

export default async function SongsPage() {
  const [songs, learningOverview] = await Promise.all([
    readPublishedSongList(),
    readLearningOverviewForPublicPage()
  ]);

  return (
    <SongsListClient
      currentLevel="N3"
      learningDays={learningOverview.learningDays}
      songs={songs}
    />
  );
}
