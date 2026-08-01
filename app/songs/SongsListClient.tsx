"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import homeStyles from "../page.module.scss";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";
import listStyles from "../notes/NotesList.module.scss";
import styles from "./SongsList.module.scss";
import { parseSongTags, SongRelatedItem } from "./songTypes";

const parallaxBalls = [
  { className: homeStyles.ballTopLeft, y: -0.1, x: 0.035 },
  { className: homeStyles.ballHeroRight, y: 0.08, x: -0.03 },
  { className: homeStyles.ballLeftLarge, y: -0.16, x: 0.055 },
  { className: homeStyles.ballHeroPink, y: 0.12, x: -0.05 },
  { className: homeStyles.ballArticleTop, y: 0.18, x: -0.07 },
  { className: homeStyles.ballSideGreen, y: -0.14, x: 0.06 },
  { className: homeStyles.ballContent, y: 0.11, x: 0.04 },
  { className: homeStyles.ballBottomLeft, y: -0.2, x: 0.075 },
  { className: homeStyles.ballBottomPink, y: 0.16, x: -0.065 },
  { className: homeStyles.ballFooterGold, y: -0.12, x: 0.05 },
  { className: homeStyles.ballFooterGreen, y: 0.14, x: -0.055 }
];

function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrollY(window.scrollY);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={homeStyles.parallax} aria-hidden="true">
      {parallaxBalls.map((ball, index) => (
        <span
          className={`${homeStyles.ball} ${ball.className}`}
          key={ball.className}
          style={{
            transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)`
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getSongCover(song: SongRelatedItem) {
  if (song.coverUrl) return song.coverUrl;
  return song.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(song.videoId)}/hqdefault.jpg` : "";
}

export default function SongsListClient({
  currentLevel = "-",
  learningDays = 0,
  songs = []
}: {
  currentLevel?: string;
  learningDays?: number;
  songs?: SongRelatedItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedLevel, setAppliedLevel] = useState("");

  const levels = useMemo(
    () => Array.from(new Set(songs.map((song) => song.level.trim()).filter(Boolean))).sort(),
    [songs]
  );
  const filteredSongs = useMemo(() => {
    const keyword = appliedQuery.trim().toLocaleLowerCase("zh-Hant");
    return songs.filter((song) => {
      const matchesLevel = !appliedLevel || song.level === appliedLevel;
      const matchesQuery = !keyword || [song.title, song.artist, song.description, song.tags].some((value) => value.toLocaleLowerCase("zh-Hant").includes(keyword));
      return matchesLevel && matchesQuery;
    });
  }, [appliedLevel, appliedQuery, songs]);
  const statItems = [
    [songs.length.toLocaleString("en-US"), "歌曲篇數"],
    [learningDays.toLocaleString("en-US"), "已學習天數"],
    [currentLevel || "-", "目前程度"]
  ];

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(query);
    setAppliedLevel(selectedLevel);
  }

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />
      <SiteHeader activeLabel="留音室" />

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>留音室</h1>
            <p className={homeStyles.heroLead}>把日文留在耳邊，跟著旋律讀歌詞、學單字與文法</p>
            <div className={homeStyles.stats} aria-label="留音室統計">
              {statItems.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="留音室插圖" width={420} height={420} priority />
            <div className={homeStyles.speech}>戴上耳機，一起聽日文</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <div className={listStyles.notesLayout}>
        <form className={listStyles.filterBar} aria-label="歌曲篩選" onSubmit={applyFilters}>
          <label>
            <span>搜尋歌曲</span>
            <input
              type="search"
              value={query}
              placeholder="輸入歌名、歌手或 tag"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>程度</span>
            <select value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value)}>
              <option value="">全部程度</option>
              {levels.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
          <button type="submit">搜尋</button>
        </form>

        <section className={listStyles.grid} aria-label="已發布歌曲">
          {filteredSongs.map((song) => {
            const cover = getSongCover(song);
            const tags = parseSongTags(song.tags).slice(0, 3);
            return (
              <a className={listStyles.card} href={`/songs/${encodeURIComponent(song.slug)}`} key={song.id}>
                <div className={listStyles.cover}>
                  {cover ? <img className={listStyles.coverImage} src={cover} alt="" /> : <div className={`${listStyles.coverFallback} ${styles.coverFallback}`}>♪</div>}
                  <span className={listStyles.categoryPill}>{song.level || "日文歌曲"}</span>
                  <span className={styles.playButton} aria-hidden="true">▶</span>
                  {song.durationSeconds > 0 ? <span className={styles.duration}>{formatDuration(song.durationSeconds)}</span> : null}
                </div>
                <div className={listStyles.cardBody}>
                  <h2>{song.title}</h2>
                  <p>{song.description || song.artist || "跟著同步歌詞，一句一句聽懂日文。"}</p>
                  <div className={listStyles.cardMeta}>
                    <span>{song.publishedDate}{song.artist ? `　${song.artist}` : ""}</span>
                    {tags.map((tag) => <strong key={tag}>#{tag}</strong>)}
                  </div>
                </div>
              </a>
            );
          })}
        </section>

        {filteredSongs.length === 0 ? <p className={listStyles.empty}>目前沒有符合條件的歌曲。</p> : null}
      </div>

      <SiteFooter />
    </main>
  );
}
