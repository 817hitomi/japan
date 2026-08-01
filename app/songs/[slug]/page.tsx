import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";
import { readLearningOverviewForPublicPage } from "../../publicData";
import homeStyles from "../../page.module.scss";
import SongPlayerClient from "../chiisana-yume/SongPlayerClient";
import { readPublishedSongBySlug, readPublishedSongList } from "../songData";
import { toSongRelatedItem } from "../songTypes";
import { createSongMetadata } from "../songMetadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SongPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: SongPageProps): Promise<Metadata> {
  const song = await readPublishedSongBySlug((await params).slug);
  return song ? createSongMetadata(song) : {};
}

export default async function SongPage({ params }: SongPageProps) {
  const slug = (await params).slug;
  if (slug === "chiisana-yume") notFound();
  const [song, learningOverview, publishedSongs] = await Promise.all([
    readPublishedSongBySlug(slug),
    readLearningOverviewForPublicPage(),
    readPublishedSongList()
  ]);
  if (!song) notFound();
  const songList = publishedSongs.some((item) => item.slug === song.slug)
    ? publishedSongs
    : [toSongRelatedItem(song), ...publishedSongs];
  return <main className={homeStyles.page}><SiteHeader /><SongPlayerClient song={song} publishedSongs={songList} learningDays={learningOverview.learningDays} /><SiteFooter /></main>;
}
