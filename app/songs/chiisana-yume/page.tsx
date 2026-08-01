import type { Metadata } from "next";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";
import { readLearningOverviewForPublicPage } from "../../publicData";
import homeStyles from "../../page.module.scss";
import { readPublishedSongBySlug, readPublishedSongList } from "../songData";
import { createSongMetadata } from "../songMetadata";
import { toSongRelatedItem } from "../songTypes";
import SongPlayerClient from "./SongPlayerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const song = await readPublishedSongBySlug("chiisana-yume");
  return song ? createSongMetadata(song) : {};
}

export default async function ChiisanaYumePage() {
  const [learningOverview, song, publishedSongs] = await Promise.all([
    readLearningOverviewForPublicPage(),
    readPublishedSongBySlug("chiisana-yume"),
    readPublishedSongList()
  ]);

  if (!song) return null;

  return (
    <main className={homeStyles.page}>
      <SiteHeader />
      <SongPlayerClient
        learningDays={learningOverview.learningDays}
        publishedSongs={publishedSongs.some((item) => item.slug === song.slug) ? publishedSongs : [toSongRelatedItem(song), ...publishedSongs]}
        song={song}
      />
      <SiteFooter />
    </main>
  );
}
