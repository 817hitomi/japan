import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readAdminAccess } from "../../../../../lib/adminRouteAuth";
import SiteFooter from "../../../../SiteFooter";
import SiteHeader from "../../../../SiteHeader";
import homeStyles from "../../../../page.module.scss";
import { readLearningOverviewForPublicPage } from "../../../../publicData";
import SongPlayerClient from "../../../../songs/chiisana-yume/SongPlayerClient";
import { readAdminSongById, readPublishedSongList } from "../../../../songs/songData";
import { toSongRelatedItem } from "../../../../songs/songTypes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "歌曲草稿預覽｜JapanNote",
  robots: { index: false, follow: false }
};

type SongPreviewPageProps = { params: Promise<{ id: string }> };

export default async function SongPreviewPage({ params }: SongPreviewPageProps) {
  const access = await readAdminAccess();
  if (access.status !== 200) notFound();

  const id = Number((await params).id);
  const [song, learningOverview, publishedSongs] = await Promise.all([
    readAdminSongById(id),
    readLearningOverviewForPublicPage(),
    readPublishedSongList()
  ]);
  if (!song) notFound();

  const songList = publishedSongs.some((item) => item.slug === song.slug)
    ? publishedSongs
    : [toSongRelatedItem(song), ...publishedSongs];

  return (
    <main className={homeStyles.page}>
      <SiteHeader />
      <SongPlayerClient song={song} publishedSongs={songList} learningDays={learningOverview.learningDays} />
      <SiteFooter />
    </main>
  );
}
