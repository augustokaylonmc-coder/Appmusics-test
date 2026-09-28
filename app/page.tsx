"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type Song = {
  title: string;
  artist: string;
  album: string;
  match: number;
  youtubeId: string;
};

const songs: Song[] = [
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    match: 96,
    youtubeId: "4NRXx6U8ABQ",
  },
  {
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    match: 91,
    youtubeId: "dX3k_QDnzHE",
  },
  {
    title: "Instant Crush",
    artist: "Daft Punk",
    album: "Random Access Memories",
    match: 89,
    youtubeId: "a5uQMwRMHcs",
  },
  {
    title: "Electric Feel",
    artist: "MGMT",
    album: "Oracular Spectacular",
    match: 87,
    youtubeId: "MmZexg8sxyk",
  },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const playerRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSong = songs[currentIndex];

  /* -----------------------------
     TIMER DA BARRA DE PROGRESSO
  ----------------------------- */

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    stopTimer();

    timerRef.current = setInterval(() => {
      const player = playerRef.current;

      if (!player) return;

      const duration = player.getDuration?.();
      const current = player.getCurrentTime?.();

      if (
        typeof duration === "number" &&
        duration > 0 &&
        typeof current === "number"
      ) {
        setProgress((current / duration) * 100);
      }
    }, 250);
  };

  /* -----------------------------
     CRIA PLAYER
  ----------------------------- */

  useEffect(() => {
    const createPlayer = () => {
      if (!window.YT?.Player) return;

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }

      setIsPlaying(false);
      setProgress(0);

      playerRef.current = new window.YT.Player("youtube-player", {
        videoId: currentSong.youtubeId,

        playerVars: {
          playsinline: 1,
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          modestbranding: 1,
        },

        events: {
          onReady: (event: any) => {
            setIsPlaying(false);
            setProgress(0);

            /*
             * Não forçamos autoplay.
             * O navegador pode bloquear autoplay.
             */
            event.target.pauseVideo();
          },

          onStateChange: (event: any) => {
            const state = event.data;

            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              startTimer();
            }

            if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              stopTimer();
            }

            if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              stopTimer();
              setProgress(0);

              nextSong();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      if (!existingScript) {
        const script = document.createElement("script");

        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;

        document.body.appendChild(script);
      }
    }

    return () => {
      stopTimer();

      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [currentIndex]);

  /* -----------------------------
     PLAY / PAUSE
  ----------------------------- */

  const togglePlay = () => {
    const player = playerRef.current;

    if (!player || !window.YT) return;

    const state = player.getPlayerState();

    if (state === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
      setIsPlaying(false);
    } else {
      player.playVideo();
      setIsPlaying(true);
    }
  };

  /* -----------------------------
     PRÓXIMA MÚSICA
  ----------------------------- */

  const nextSong = () => {
    stopTimer();

    setProgress(0);
    setIsPlaying(false);

    setCurrentIndex((index) => {
      if (index >= songs.length - 1) {
        return 0;
      }

      return index + 1;
    });
  };

  /* -----------------------------
     LIKE
  ----------------------------- */

  const likeSong = () => {
    const alreadyLiked = likedSongs.some(
      (song) => song.youtubeId === currentSong.youtubeId
    );

    if (!alreadyLiked) {
      setLikedSongs((songs) => [...songs, currentSong]);
    }

    nextSong();
  };

  /* -----------------------------
     PASSAR
  ----------------------------- */

  const passSong = () => {
    nextSong();
  };

  /* -----------------------------
     SEEK
  ----------------------------- */

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const player = playerRef.current;

    if (!player) return;

    const duration = player.getDuration?.();

    if (!duration || duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const position = event.clientX - rect.left;

    const percentage = Math.max(
      0,
      Math.min(1, position / rect.width)
    );

    player.seekTo(duration * percentage, true);

    setProgress(percentage * 100);
  };

  /* -----------------------------
     RENDER
  ----------------------------- */

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6">

        {/* HEADER */}

        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              MusicSwipe
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Descubra músicas que combinam com você
            </p>
          </div>

          <div className="rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-400">
            {likedSongs.length} curtidas
          </div>
        </header>

        {/* CONTEÚDO */}

        <div className="grid flex-1 gap-8 lg:grid-cols-[1fr_320px]">

          {/* PLAYER */}

          <section className="flex flex-col">

            <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-zinc-950 shadow-2xl">

              <div
                id="youtube-player"
                className="absolute inset-0 h-full w-full"
              />

              {/* Impede que os controles do YouTube apareçam/interajam */}

              <div className="absolute inset-0 z-10" />

              {/* INFORMAÇÕES */}

              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/70 to-transparent px-7 pb-7 pt-24">

                <div className="flex items-end justify-between gap-4">

                  <div>

                    <p className="mb-2 text-sm font-medium text-zinc-400">
                      {currentSong.album}
                    </p>

                    <h2 className="text-3xl font-bold">
                      {currentSong.title}
                    </h2>

                    <p className="mt-1 text-lg text-zinc-300">
                      {currentSong.artist}
                    </p>

                  </div>

                  <div className="flex-shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
                    {currentSong.match}% match
                  </div>

                </div>

              </div>
            </div>

            {/* CONTROLES */}

            <div className="mt-5">

              {/* BARRA */}

              <div
                onClick={seek}
                className="group h-2 w-full cursor-pointer rounded-full bg-zinc-800"
              >
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              {/* BOTÕES */}

              <div className="mt-5 flex items-center justify-center gap-5">

                {/* PASSAR */}

                <button
                  onClick={passSong}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xl text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  title="Passar"
                >
                  ✕
                </button>

                {/* PLAY / PAUSE */}

                <button
                  onClick={togglePlay}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl text-black transition hover:scale-105"
                  title={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? "❚❚" : "▶"}
                </button>

                {/* LIKE */}

                <button
                  onClick={likeSong}
                  className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xl text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  title="Curtir"
                >
                  ♥
                </button>

              </div>

              <div className="mt-5 text-center text-xs text-zinc-600">
                Música {currentIndex + 1} de {songs.length}
              </div>

            </div>
          </section>

          {/* CURTIDAS */}

          <aside className="rounded-3xl border border-zinc-900 bg-zinc-950 p-5">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <h3 className="font-semibold">
                  Suas curtidas
                </h3>

                <p className="mt-1 text-xs text-zinc-600">
                  Músicas que você escolheu
                </p>
              </div>

              <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                {likedSongs.length}
              </span>

            </div>

            {likedSongs.length === 0 ? (

              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-6 text-center">

                <p className="text-sm leading-6 text-zinc-600">
                  Suas músicas curtidas aparecerão aqui.
                </p>

              </div>

            ) : (

              <div className="space-y-3">

                {likedSongs.map((song) => (

                  <div
                    key={song.youtubeId}
                    className="flex items-center gap-3 rounded-2xl bg-zinc-900/60 p-3"
                  >

                    <img
                      src={`https://i.ytimg.com/vi/${song.youtubeId}/default.jpg`}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />

                    <div className="min-w-0">

                      <p className="truncate text-sm font-medium">
                        {song.title}
                      </p>

                      <p className="truncate text-xs text-zinc-500">
                        {song.artist}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </aside>
        </div>
      </div>
    </main>
  );
}