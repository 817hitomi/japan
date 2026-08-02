"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { readingsToSpeechText, renderInlineRuby } from "../../../lib/japaneseText";
import homeStyles from "../../page.module.scss";
import { parseSongTags, SongLyricLine, SongRecord, SongRelatedItem } from "../songTypes";
import NoteBlocksContent from "../../notes/NoteBlocksContent";
import styles from "./SongPlayer.module.scss";

const JAPANESE_SPEECH_RATE = 0.9;
const PREFERRED_JAPANESE_VOICE_NAME = "Google 日本語";

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

type YouTubePlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
};

type YouTubePlayerEvent = { target: YouTubePlayer; data: number };

type YouTubeNamespace = {
  Player: new (elementId: string, options: {
    videoId: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: (event: YouTubePlayerEvent) => void;
      onStateChange: (event: YouTubePlayerEvent) => void;
    };
  }) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function formatTime(value: number) {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(safeValue / 60)}:${String(safeValue % 60).padStart(2, "0")}`;
}

function findActiveLine(time: number, lyricLines: SongLyricLine[]) {
  let active = 0;
  for (let index = 0; index < lyricLines.length; index += 1) {
    if (time >= lyricLines[index].start) active = index;
    else break;
  }
  return active;
}

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === PREFERRED_JAPANESE_VOICE_NAME)
    ?? voices.find((voice) => voice.lang.startsWith("ja"))
    ?? null;
}

function SongPageBackground() {
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
          style={{ transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)` }}
        />
      ))}
    </div>
  );
}

export default function SongPlayerClient({
  learningDays,
  publishedSongs = [],
  song
}: {
  learningDays: number;
  publishedSongs?: SongRelatedItem[];
  song: SongRecord;
}) {
  const lyricLines = useMemo(
    () => song.lyrics.length > 0 ? song.lyrics : [{ section: "Verse", start: 0, end: song.durationSeconds, japanese: song.title, translation: song.description }],
    [song]
  );
  const playerElementId = `song-youtube-player-${song.slug}-${song.videoId}`;
  const playerRef = useRef<YouTubePlayer | null>(null);
  const studyTocItems = useMemo(
    () => [
      ...song.noteBlocks
        .map((block, index) => ({ id: `song-note-section-${index}`, label: block.heading?.trim() ?? "" }))
        .filter((item) => item.label),
      ...(song.vocabulary.length > 0 ? [{ id: "song-vocabulary", label: "歌詞單字與重要單字" }] : [])
    ],
    [song.noteBlocks, song.vocabulary.length]
  );
  const relatedSongs = useMemo(
    () => publishedSongs.filter((item) => item.slug !== song.slug).slice(0, 5),
    [publishedSongs, song.slug]
  );
  const songTags = useMemo(() => {
    const counts = new Map<string, number>();

    publishedSongs.forEach((item) => {
      parseSongTags(item.tags)
        .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return Array.from(counts.entries())
      .sort(([firstTag, firstCount], [secondTag, secondCount]) => secondCount - firstCount || firstTag.localeCompare(secondTag, "zh-Hant"))
      .slice(0, 12);
  }, [publishedSongs]);
  const pendingSeekRef = useRef<number | null>(null);
  const shouldAutoplayRef = useRef(false);
  const playerCardRef = useRef<HTMLElement | null>(null);
  const fullscreenControlsTimerRef = useRef<number | null>(null);
  const lyricsViewportRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.durationSeconds || 1);
  const [volume, setVolume] = useState(50);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(true);

  const speakVocabulary = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(readingsToSpeechText(text));
    const voice = getJapaneseVoice();
    utterance.lang = "ja-JP";
    if (voice) utterance.voice = voice;
    utterance.rate = JAPANESE_SPEECH_RATE;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!loaded) return;
    let disposed = false;
    const previousReady = window.onYouTubeIframeAPIReady;

    const createPlayer = () => {
      if (disposed || playerRef.current || !window.YT || !document.getElementById(playerElementId)) return;
      playerRef.current = new window.YT.Player(playerElementId, {
        videoId: song.videoId,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            event.target.setVolume(volume);
            setDuration(event.target.getDuration() || song.durationSeconds || 1);
            setReady(true);
            if (pendingSeekRef.current !== null) {
              event.target.seekTo(pendingSeekRef.current, true);
              pendingSeekRef.current = null;
            }
            if (shouldAutoplayRef.current) event.target.playVideo();
          },
          onStateChange: (event) => setPlaying(event.data === 1)
        }
      });
    };

    if (window.YT?.Player) createPlayer();
    else {
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        createPlayer();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      disposed = true;
      if (typeof playerRef.current?.destroy === "function") playerRef.current.destroy();
      playerRef.current = null;
      setReady(false);
    };
  }, [loaded, playerElementId, song.durationSeconds, song.videoId]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const nextTime = player.getCurrentTime() || 0;
      const nextIndex = findActiveLine(nextTime, lyricLines);
      setCurrentTime(nextTime);
      setDuration(player.getDuration() || song.durationSeconds || 1);
      setActiveIndex(nextIndex);
    }, 200);
    return () => window.clearInterval(timer);
  }, [loaded, lyricLines, song.durationSeconds]);

  useEffect(() => {
    const viewport = lyricsViewportRef.current;
    const activeLine = lineRefs.current[activeIndex];
    if (!viewport || !activeLine) return;
    const viewportRect = viewport.getBoundingClientRect();
    const activeLineRect = activeLine.getBoundingClientRect();
    const targetTop = viewport.scrollTop
      + activeLineRect.top
      - viewportRect.top
      - viewport.clientHeight / 2
      + activeLineRect.height / 2;
    viewport.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [activeIndex]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === playerCardRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const activeLine = lyricLines[activeIndex];

  const startPlayback = () => {
    shouldAutoplayRef.current = true;
    if (!loaded) setLoaded(true);
    else playerRef.current?.playVideo();
  };

  const togglePlayback = () => {
    if (!loaded || !ready) return startPlayback();
    if (playing) playerRef.current?.pauseVideo();
    else playerRef.current?.playVideo();
  };

  const jumpToLine = (index: number) => {
    const start = lyricLines[index].start;
    setActiveIndex(index);
    setCurrentTime(start);
    shouldAutoplayRef.current = true;
    if (!loaded || !ready) {
      pendingSeekRef.current = start;
      setLoaded(true);
      return;
    }
    playerRef.current?.seekTo(start, true);
    playerRef.current?.playVideo();
  };

  const changeLine = (offset: number) => jumpToLine(Math.min(lyricLines.length - 1, Math.max(0, activeIndex + offset)));

  const changeSpeed = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    playerRef.current?.setPlaybackRate(nextRate);
  };

  const toggleFullscreen = async () => {
    const playerCard = playerCardRef.current;
    if (!playerCard || !document.fullscreenEnabled) return;

    try {
      if (document.fullscreenElement === playerCard) await document.exitFullscreen();
      else await playerCard.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const revealFullscreenControls = () => {
    setFullscreenControlsVisible(true);
    if (fullscreenControlsTimerRef.current !== null) window.clearTimeout(fullscreenControlsTimerRef.current);
    if (isFullscreen && playing) {
      fullscreenControlsTimerRef.current = window.setTimeout(() => setFullscreenControlsVisible(false), 2500);
    }
  };

  useEffect(() => {
    setFullscreenControlsVisible(true);
    if (fullscreenControlsTimerRef.current !== null) window.clearTimeout(fullscreenControlsTimerRef.current);
    if (isFullscreen && playing) {
      fullscreenControlsTimerRef.current = window.setTimeout(() => setFullscreenControlsVisible(false), 2500);
    }

    return () => {
      if (fullscreenControlsTimerRef.current !== null) window.clearTimeout(fullscreenControlsTimerRef.current);
    };
  }, [isFullscreen, playing]);

  return (
    <>
      <SongPageBackground />
      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>歌曲學習</h1>
            <p className={homeStyles.heroLead}>跟著旋律讀歌詞，把日文自然地唱進記憶裡</p>
            <div className={homeStyles.stats} aria-label="歌曲學習資訊">
              <div><strong>{publishedSongs.length.toLocaleString("en-US")}</strong><span>首歌曲</span></div>
              <div><strong>{learningDays.toLocaleString("en-US")}</strong><span>已學習天數</span></div>
              <div><strong>{song.level}</strong><span>目前程度</span></div>
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="JapanNote 歌曲學習角色" width={420} height={420} priority />
            <div className={homeStyles.speech}>跟著音樂一起學吧</div>
          </div>
        </div>
      </section>

      <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{song.eyebrow}</p>
          <h1>{song.title}</h1>
          <p className={styles.artist}>{song.artist}</p>
        </div>
        <div className={styles.tags} aria-label="歌曲資訊"><span>{formatTime(song.durationSeconds)}</span></div>
      </section>

      <section ref={playerCardRef} className={styles.playerCard} aria-label="同步影片播放器" onPointerMove={revealFullscreenControls} onPointerDown={revealFullscreenControls}>
        <div className={styles.videoShell}>
          {loaded ? <div key={song.videoId} id={playerElementId} className={styles.youtubePlayer} /> : (
            <button
              className={styles.videoPoster}
              type="button"
              onClick={startPlayback}
              aria-label={`載入並播放${song.title}`}
              style={{ backgroundImage: `linear-gradient(180deg, rgba(18, 29, 46, 0.08), rgba(10, 15, 25, 0.64)), url("https://i.ytimg.com/vi/${encodeURIComponent(song.videoId)}/maxresdefault.jpg")` }}
            >
              <span className={styles.playMark}>▶</span><span>播放歌曲</span>
            </button>
          )}
          {captionsVisible ? (
            <div className={styles.videoCaption} aria-live="polite">
              <p dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeLine.japanese) }} />
              <span>{activeLine.translation}</span>
            </div>
          ) : null}
        </div>

        <div className={`${styles.controls} ${isFullscreen && !fullscreenControlsVisible ? styles.controlsHidden : ""}`} onFocusCapture={revealFullscreenControls}>
          <button className={styles.primaryControl} type="button" onClick={togglePlayback} aria-label={playing ? "暫停" : "播放"}>{playing ? "Ⅱ" : "▶"}</button>
          <label className={styles.volumeControl}><span aria-hidden="true">♪</span><input type="range" min="0" max="100" value={volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); playerRef.current?.setVolume(value); }} /></label>
          <div className={styles.progressGroup}>
            <input type="range" min="0" max={duration || 1} step="0.1" value={Math.min(currentTime, duration || 1)} aria-label="播放進度" onChange={(event) => { const value = Number(event.target.value); setCurrentTime(value); setActiveIndex(findActiveLine(value, lyricLines)); playerRef.current?.seekTo(value, true); }} />
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <button type="button" onClick={() => changeLine(-1)} disabled={activeIndex === 0} aria-label="上一句">‹</button>
          <button type="button" onClick={() => changeLine(1)} disabled={activeIndex === lyricLines.length - 1} aria-label="下一句">›</button>
          <button type="button" onClick={changeSpeed}>{playbackRate}x</button>
          <button className={captionsVisible ? styles.activeControl : ""} type="button" onClick={() => setCaptionsVisible((value) => !value)} aria-pressed={captionsVisible}>{captionsVisible ? "關閉字幕" : "開啟字幕"}</button>
          <button className={styles.fullscreenControl} type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "退出全螢幕" : "全螢幕"} aria-pressed={isFullscreen} title={isFullscreen ? "退出全螢幕" : "全螢幕"}>
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /></svg>
            )}
          </button>
        </div>
      </section>

      <section className={styles.lyricsCard}>
        <div className={styles.lyricsHeading}>
          <div><p className={styles.eyebrow}>Lyrics</p><h2>歌詞與翻譯</h2></div>
          <p>點擊任一句即可跳到對應位置</p>
        </div>
        <div className={styles.lyricsViewport} ref={lyricsViewportRef}>
          {lyricLines.map((line, index) => {
            const showSection = index === 0 || lyricLines[index - 1].section !== line.section;
            const isActive = index === activeIndex;
            return (
              <div className={styles.lineGroup} key={`${line.section}-${line.start}`}>
                {showSection ? <p className={styles.sectionLabel}>{line.section}</p> : null}
                <button ref={(element) => { lineRefs.current[index] = element; }} className={`${styles.lyricLine} ${isActive ? styles.activeLine : ""}`} type="button" onClick={() => jumpToLine(index)} aria-current={isActive ? "true" : undefined}>
                  <span className={styles.lineTime}>{formatTime(line.start)}</span>
                  <span className={styles.lineText} dangerouslySetInnerHTML={{ __html: renderInlineRuby(line.japanese) }} />
                  <span className={styles.translation}>{line.translation}</span>
                </button>
              </div>
            );
          })}
        </div>
        <p className={styles.prototypeNote}>點擊任一句即可跳到對應位置</p>
      </section>

      <div className={styles.studyLayout}>
      <article className={styles.studyNotes} aria-labelledby="song-study-title">
        <header className={styles.studyTitleRow}>
          <span className={styles.studyTitleBar} />
          <div>
            <p className={styles.eyebrow}>Song Study Note</p>
            <h2 id="song-study-title">歌詞學習筆記</h2>
            <p className={styles.studyMeta}>{song.title}・歌詞文法分析</p>
          </div>
        </header>

        {studyTocItems.length > 0 ? (
          <nav aria-label="文章內容（手機版）" className={`${styles.studyToc} ${styles.mobileStudyToc}`}>
            <strong>文章內容</strong>
            {studyTocItems.map((item) => (
              <a href={`#${item.id}`} key={item.id}>{item.label}</a>
            ))}
          </nav>
        ) : null}

        <NoteBlocksContent blocks={song.noteBlocks} idPrefix="song-note-section" />

        <section className={styles.studyBlock} id="song-vocabulary">
          <h3>歌詞中的重要單字</h3>
          <div className={styles.vocabularyGrid}>
            {song.vocabulary.map((word, index) => (
              <article className={styles.vocabularyCard} key={`${word.japanese}-${index}`}>
                <button className={styles.audioMark} type="button" onClick={() => speakVocabulary(word.japanese)} aria-label={`播放 ${word.japanese}`}><Image src="/brand/muc.png" alt="" width={25} height={25} /></button>
                <div className={styles.vocabularyCardTop}><small>{word.partOfSpeech}</small><strong dangerouslySetInnerHTML={{ __html: renderInlineRuby(word.japanese) }} /></div>
                <div className={styles.vocabularyCardBottom}>{word.translation}</div>
              </article>
            ))}
          </div>
        </section>
      </article>

      {studyTocItems.length > 0 ? (
        <aside className={styles.studySidebar}>
          <nav
            aria-label="文章內容"
            className={styles.studyToc}
          >
            <strong>文章內容</strong>
            {studyTocItems.map((item) => (
              <a href={`#${item.id}`} key={item.id}>{item.label}</a>
            ))}
          </nav>
        </aside>
      ) : null}
      </div>

      <div className={styles.songEndSections}>
        <section>
          <h2>熱門歌曲</h2>
          {relatedSongs.length > 0 ? (
            <div className={styles.songLinkList}>
              {relatedSongs.map((item) => (
                <a href={`/songs/${encodeURIComponent(item.slug)}`} key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.level}　{item.publishedDate}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.emptySongSection}>目前尚無其他歌曲</p>
          )}
        </section>

        <section>
          <h2>tag</h2>
          {songTags.length > 0 ? (
            <div className={styles.songTagList}>
              {songTags.map(([tag, count]) => (
                <span className={styles.songTag} key={tag}>
                  <b>{tag}</b>
                  <strong>{count}</strong>
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.emptySongSection}>目前尚無 tag</p>
          )}
        </section>
      </div>
      </div>
    </>
  );
}
