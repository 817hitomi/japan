"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { readingsToSpeechText, renderInlineRuby } from "../../../lib/japaneseText";
import homeStyles from "../../page.module.scss";
import styles from "./SongPlayer.module.scss";

const VIDEO_ID = "PRMMBraH_k4";
const PLAYER_ELEMENT_ID = "chiisana-yume-youtube-player";
const JAPANESE_SPEECH_RATE = 0.8;
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

type LyricSection = "Verse" | "Chorus" | "Verse 2" | "Prechorus" | "Bridge";

type LyricLine = {
  section: LyricSection;
  start: number;
  end: number;
  japanese: string;
  translation: string;
};

const lyricLines: LyricLine[] = [
  { section: "Verse", start: 5, end: 14, japanese: "朝(あさ)の光(ひかり)　窓(まど)を開(あ)けて", translation: "在晨光中，打開窗戶" },
  { section: "Verse", start: 14, end: 23, japanese: "小(ちい)さな夢(ゆめ)を　胸(むね)に抱(だ)いて", translation: "將小小的夢想抱在心中" },
  { section: "Verse", start: 23, end: 32, japanese: "今日(きょう)も一歩(いっぽ)　前(まえ)へ進(すす)む", translation: "今天也向前跨出一步" },
  { section: "Verse", start: 32, end: 41, japanese: "言葉(ことば)の種(たね)　未来(みらい)に咲(さ)く", translation: "言語的種子在未來綻放" },
  { section: "Chorus", start: 41, end: 50, japanese: "学(まな)ぶ心(こころ)　強(つよ)くなる", translation: "求知的心會變得更加堅強" },
  { section: "Chorus", start: 50, end: 59, japanese: "空(そら)の青(あお)に　願(ねが)いを乗(の)せ", translation: "把願望寄託在蔚藍天空" },
  { section: "Chorus", start: 59, end: 68, japanese: "一緒(いっしょ)ならば　道(みち)は見(み)える", translation: "只要在一起，就能看見前路" },
  { section: "Chorus", start: 68, end: 78, japanese: "希望(きぼう)の歌(うた)　響(ひび)けるよ", translation: "讓希望之歌響起吧" },
  { section: "Verse 2", start: 81, end: 90, japanese: "昼(ひる)の風(かぜ)に　ページめくれば", translation: "在午後的風中翻開書頁" },
  { section: "Verse 2", start: 90, end: 99, japanese: "新(あたら)しい音(おと)　心(こころ)を呼(よ)ぶ", translation: "嶄新的聲音呼喚著心靈" },
  { section: "Verse 2", start: 99, end: 108, japanese: "少(すこ)しずつでも　分(わ)かっていく", translation: "即使一點一點，也會逐漸明白" },
  { section: "Verse 2", start: 108, end: 118, japanese: "日々(ひび)の努力(どりょく)　光(ひかり)に変(か)わる", translation: "每一天的努力都將化為光芒" },
  { section: "Prechorus", start: 118, end: 127, japanese: "迷(まよ)う時(とき)も　立(た)ち止(ど)まって", translation: "迷惘的時候，也停下腳步" },
  { section: "Prechorus", start: 127, end: 137, japanese: "見上(みあ)げる空(そら)に　答(こた)えがある", translation: "仰望的天空中藏著答案" },
  { section: "Bridge", start: 140, end: 149, japanese: "夜(よる)の静(しず)けさ　夢(ゆめ)を描(えが)き", translation: "在夜晚的寧靜中描繪夢想" },
  { section: "Bridge", start: 149, end: 158, japanese: "明日(あした)の僕(ぼく)に　笑顔(えがお)をくれる", translation: "為明天的我帶來笑容" },
  { section: "Bridge", start: 158, end: 167, japanese: "どんな壁(かべ)も　越(こ)えて行(い)ける", translation: "無論什麼高牆都能跨越" },
  { section: "Bridge", start: 167, end: 180, japanese: "小(ちい)さな勇気(ゆうき)　道(みち)を照(て)らす", translation: "小小的勇氣照亮前路" }
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

function findActiveLine(time: number) {
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

export default function SongPlayerClient({ learningDays }: { learningDays: number }) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const shouldAutoplayRef = useRef(false);
  const lineLoopRef = useRef(false);
  const lyricsViewportRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(185);
  const [volume, setVolume] = useState(50);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lineLoop, setLineLoop] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

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

  useEffect(() => { lineLoopRef.current = lineLoop; }, [lineLoop]);

  useEffect(() => {
    if (!loaded) return;
    let disposed = false;
    const previousReady = window.onYouTubeIframeAPIReady;

    const createPlayer = () => {
      if (disposed || playerRef.current || !window.YT || !document.getElementById(PLAYER_ELEMENT_ID)) return;
      playerRef.current = new window.YT.Player(PLAYER_ELEMENT_ID, {
        videoId: VIDEO_ID,
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            event.target.setVolume(volume);
            setDuration(event.target.getDuration() || 185);
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
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const nextTime = player.getCurrentTime() || 0;
      const nextIndex = findActiveLine(nextTime);
      const currentLine = lyricLines[nextIndex];
      if (lineLoopRef.current && nextTime >= currentLine.end) {
        player.seekTo(currentLine.start, true);
        return;
      }
      setCurrentTime(nextTime);
      setDuration(player.getDuration() || 185);
      setActiveIndex(nextIndex);
    }, 200);
    return () => window.clearInterval(timer);
  }, [loaded]);

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

  return (
    <>
      <SongPageBackground />
      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>歌曲學習</h1>
            <p className={homeStyles.heroLead}>跟著旋律讀歌詞，把日文自然地唱進記憶裡</p>
            <div className={homeStyles.stats} aria-label="歌曲學習資訊">
              <div><strong>1</strong><span>首歌曲</span></div>
              <div><strong>{learningDays.toLocaleString("en-US")}</strong><span>已學習天數</span></div>
              <div><strong>N4</strong><span>目前程度</span></div>
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="JapanNote 歌曲學習角色" width={420} height={420} priority />
            <div className={homeStyles.speech}>跟著音樂一起學吧</div>
          </div>
        </div>
      </section>

      <div className={`${styles.page} ${focusMode ? styles.focusMode : ""}`}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>同步歌詞試作</p>
          <h1>小さな夢</h1>
          <p className={styles.artist}>自學日文筆記・日文留音室</p>
        </div>
        <div className={styles.tags} aria-label="歌曲資訊"><span>3:05</span></div>
      </section>

      <section className={styles.playerCard} aria-label="同步影片播放器">
        <div className={styles.videoShell}>
          {loaded ? <div id={PLAYER_ELEMENT_ID} className={styles.youtubePlayer} /> : (
            <button className={styles.videoPoster} type="button" onClick={startPlayback} aria-label="載入並播放小さな夢">
              <span className={styles.playMark}>▶</span><span>播放歌曲</span>
            </button>
          )}
          <div className={styles.videoCaption} aria-live="polite">
            <p dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeLine.japanese) }} />
            <span>{activeLine.translation}</span>
          </div>
        </div>

        <div className={styles.controls}>
          <button className={styles.primaryControl} type="button" onClick={togglePlayback} aria-label={playing ? "暫停" : "播放"}>{playing ? "Ⅱ" : "▶"}</button>
          <label className={styles.volumeControl}><span aria-hidden="true">♪</span><input type="range" min="0" max="100" value={volume} aria-label="音量" onChange={(event) => { const value = Number(event.target.value); setVolume(value); playerRef.current?.setVolume(value); }} /></label>
          <div className={styles.progressGroup}>
            <input type="range" min="0" max={duration || 185} step="0.1" value={Math.min(currentTime, duration || 185)} aria-label="播放進度" onChange={(event) => { const value = Number(event.target.value); setCurrentTime(value); setActiveIndex(findActiveLine(value)); playerRef.current?.seekTo(value, true); }} />
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
          <button type="button" onClick={() => changeLine(-1)} disabled={activeIndex === 0} aria-label="上一句">‹</button>
          <button type="button" onClick={() => changeLine(1)} disabled={activeIndex === lyricLines.length - 1} aria-label="下一句">›</button>
          <button className={lineLoop ? styles.activeControl : ""} type="button" onClick={() => setLineLoop((value) => !value)} aria-pressed={lineLoop}>單句循環</button>
          <button type="button" onClick={changeSpeed}>{playbackRate}x</button>
          <button className={focusMode ? styles.activeControl : ""} type="button" onClick={() => setFocusMode((value) => !value)} aria-pressed={focusMode}>專注模式</button>
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
        <p className={styles.prototypeNote}>目前使用約略時間碼驗證前台互動；正式上線前可在後台逐句微調。</p>
      </section>

      <article className={styles.studyNotes} aria-labelledby="song-study-title">
        <header className={styles.studyTitleRow}>
          <span className={styles.studyTitleBar} />
          <div>
            <p className={styles.eyebrow}>Song Study Note</p>
            <h2 id="song-study-title">歌詞學習筆記</h2>
            <p className={styles.studyMeta}>小さな夢・歌詞文法分析</p>
          </div>
        </header>

        <section className={styles.studySummary}>
          這裡可以接續學習筆記的文章內容，整理歌曲中的文法、重要表現、單字與延伸例句。以下先以這首歌的內容示範閱讀版型。
        </section>

        <section className={styles.studyBlock}>
          <h3>文法解析：～ならば</h3>
          <div className={styles.studyBody}>
            <p className={styles.grammarExample} dangerouslySetInnerHTML={{ __html: renderInlineRuby("一緒(いっしょ)ならば　道(みち)は見(み)える") }} />
            <p><strong>～ならば</strong> 表示假設條件，相當於中文的「如果……的話」。比口語常見的「～なら」稍正式，在歌詞中也能帶出較完整、抒情的語氣。</p>
            <p className={styles.translationExample}>只要在一起，就能看見前路。</p>
          </div>
        </section>

        <section className={styles.studyBlock}>
          <h3>文法解析：～ていく</h3>
          <div className={styles.studyBody}>
            <p className={styles.grammarExample} dangerouslySetInnerHTML={{ __html: renderInlineRuby("少(すこ)しずつでも　分(わ)かっていく") }} />
            <p><strong>～ていく</strong> 可以表示某個動作或變化從現在開始，繼續朝未來發展。這句表達「即使速度很慢，理解仍會一點一點累積」。</p>
            <div className={styles.noteBox}><strong>學習提示</strong><span>「少しずつ」是「一點一點、逐漸」；加上「でも」帶有「即使只是……也」的語氣。</span></div>
          </div>
        </section>

        <section className={styles.studyBlock}>
          <h3>歌詞中的重要單字</h3>
          <div className={styles.vocabularyGrid}>
            <article className={styles.vocabularyCard}>
              <button className={styles.audioMark} type="button" onClick={() => speakVocabulary("抱(だ)く")} aria-label="播放 抱く"><Image src="/brand/muc.png" alt="" width={25} height={25} /></button>
              <div className={styles.vocabularyCardTop}><small>動詞</small><strong dangerouslySetInnerHTML={{ __html: renderInlineRuby("抱(だ)く") }} /></div>
              <div className={styles.vocabularyCardBottom}>懷抱、抱持</div>
            </article>
            <article className={styles.vocabularyCard}>
              <button className={styles.audioMark} type="button" onClick={() => speakVocabulary("響(ひび)く")} aria-label="播放 響く"><Image src="/brand/muc.png" alt="" width={25} height={25} /></button>
              <div className={styles.vocabularyCardTop}><small>動詞</small><strong dangerouslySetInnerHTML={{ __html: renderInlineRuby("響(ひび)く") }} /></div>
              <div className={styles.vocabularyCardBottom}>響起、迴盪</div>
            </article>
            <article className={styles.vocabularyCard}>
              <button className={styles.audioMark} type="button" onClick={() => speakVocabulary("努力(どりょく)")} aria-label="播放 努力"><Image src="/brand/muc.png" alt="" width={25} height={25} /></button>
              <div className={styles.vocabularyCardTop}><small>名詞</small><strong dangerouslySetInnerHTML={{ __html: renderInlineRuby("努力(どりょく)") }} /></div>
              <div className={styles.vocabularyCardBottom}>努力</div>
            </article>
            <article className={styles.vocabularyCard}>
              <button className={styles.audioMark} type="button" onClick={() => speakVocabulary("照(て)らす")} aria-label="播放 照らす"><Image src="/brand/muc.png" alt="" width={25} height={25} /></button>
              <div className={styles.vocabularyCardTop}><small>動詞</small><strong dangerouslySetInnerHTML={{ __html: renderInlineRuby("照(て)らす") }} /></div>
              <div className={styles.vocabularyCardBottom}>照亮</div>
            </article>
          </div>
        </section>
      </article>
      </div>
    </>
  );
}
