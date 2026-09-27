"use client";

import { useEffect, useRef, useState } from "react";

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

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [spotifyMessage, setSpotifyMessage] = useState(false);

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentSong = songs[currentIndex];

  /*
   * CARREGA A API DO YOUTUBE
   */
  useEffect(() => {
    if (window.YT) {
      createPlayer();
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");

      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;

      document.body.appendChild(script);
    }

    window.onYouTubeIframeAPIReady = () => {
      createPlayer();
    };

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  /*
   * CRIA O PLAYER DO YOUTUBE
   */
  function createPlayer() {
    if (!playerContainerRef.current || !window.YT) {
      return;
    }

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      height: "100%",
      width: "100%",
      videoId: currentSong.youtubeId,

      playerVars: {
        playsinline: 1,
        controls: 1,
        rel: 0,
      },

      events: {
        onReady: (event: any) => {
          setDuration(event.target.getDuration());

          timerRef.current = setInterval(() => {
            if (!playerRef.current) {
              return;
            }

            const time = playerRef.current.getCurrentTime();
            const total = playerRef.current.getDuration();

            setCurrentTime(time);

            if (total > 0) {
              setDuration(total);
            }
          }, 250);
        },

        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setPlaying(true);
          }

          if (event.data === window.YT.PlayerState.PAUSED) {
            setPlaying(false);
          }

          if (event.data === window.YT.PlayerState.ENDED) {
            setPlaying(false);
            nextSong();
          }
        },
      },
    });
  }

  /*
   * TROCA O VÍDEO QUANDO A MÚSICA MUDA
   */
  useEffect(() => {
    if (!playerRef.current || !currentSong) {
      return;
    }

    playerRef.current.loadVideoById(currentSong.youtubeId);

    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);

    const durationTimer = setTimeout(() => {
      if (playerRef.current) {
        setDuration(playerRef.current.getDuration());
      }
    }, 1000);

    return () => {
      clearTimeout(durationTimer);
    };
  }, [currentIndex]);

  /*
   * PRÓXIMA MÚSICA
   */
  function nextSong() {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (currentIndex < songs.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setCurrentIndex(0);
    }
  }

  /*
   * CURTIR
   */
  function likeSong() {
    if (!currentSong) {
      return;
    }

    setLikedSongs((current) => {
      const alreadyLiked = current.some(
        (song) =>
          song.title === currentSong.title &&
          song.artist === currentSong.artist
      );

      if (alreadyLiked) {
        return current;
      }

      return [...current, currentSong];
    });

    nextSong();
  }

  /*
   * PASSAR
   */
  function passSong() {
    nextSong();
  }

  /*
   * FORMATA O TEMPO
   */
  function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "0:00";
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  const progress =
    duration > 0
      ? Math.min((currentTime / duration) * 100, 100)
      : 0;

  if (!currentSong) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">

        {/* HEADER */}

        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Music<span className="text-pink-500">Swipe</span>
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Descubra músicas que combinam com você
            </p>
          </div>

          <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
            ❤️ {likedSongs.length} curtidas
          </div>
        </header>

        {/* CONTEÚDO */}

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 lg:flex-row">

          {/* CARD DA MÚSICA */}

          <section className="w-full max-w-sm">

            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">

              {/* VÍDEO */}

              <div className="relative aspect-square w-full overflow-hidden bg-black">

                <div
                  ref={playerContainerRef}
                  className="absolute inset-0 h-full w-full"
                />

                {/* COMPATIBILIDADE */}

                <div className="absolute left-4 top-4 z-10 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  {currentSong.match}% compatível
                </div>

              </div>

              {/* INFORMAÇÕES DA MÚSICA */}

              <div className="px-5 pt-5">

                <p className="text-sm text-zinc-400">
                  {currentSong.album}
                </p>

                <h2 className="mt-1 text-3xl font-bold leading-tight">
                  {currentSong.title}
                </h2>

                <p className="mt-1 text-lg text-zinc-300">
                  {currentSong.artist}
                </p>

              </div>

              {/* BARRA DE PROGRESSO */}

              <div className="px-5 pb-5 pt-5">

                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-700">

                  <div
                    className="h-full rounded-full bg-pink-500 transition-all"
                    style={{
                      width: `${progress}%`,
                    }}
                  />

                </div>

                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                  <span>{formatTime(currentTime)}</span>

                  <span>{formatTime(duration)}</span>
                </div>

              </div>

            </div>

            {/* BOTÕES */}

            <div className="mt-6 flex items-center justify-center gap-6">

              {/* PASSAR */}

              <button
                onClick={passSong}
                aria-label="Passar música"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-red-500 hover:bg-red-500/10"
              >
                ❌
              </button>

              {/* CURTIR */}

              <button
                onClick={likeSong}
                aria-label="Curtir música"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-3xl shadow-lg shadow-pink-500/20 transition hover:scale-110 hover:bg-pink-400"
              >
                ❤️
              </button>

              {/* PRÓXIMA */}

              <button
                onClick={nextSong}
                aria-label="Próxima música"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-zinc-500"
              >
                ⏭️
              </button>

            </div>

            <p className="mt-5 text-center text-xs text-zinc-600">
              ❌ Passar &nbsp; • &nbsp; ❤️ Curtir &nbsp; • &nbsp; Controles do YouTube para reprodução
            </p>

          </section>

          {/* LISTA DE CURTIDAS */}

          <aside className="w-full max-w-sm lg:w-80">

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">

              <div className="flex items-center justify-between">

                <h3 className="font-semibold">
                  Suas curtidas
                </h3>

                <span className="text-sm text-zinc-500">
                  {likedSongs.length}
                </span>

              </div>

              {likedSongs.length === 0 ? (

                <div className="py-12 text-center">

                  <div className="text-4xl">
                    🎵
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    Suas músicas curtidas aparecerão aqui.
                  </p>

                </div>

              ) : (

                <div className="mt-4 space-y-3">

                  {likedSongs.map((song) => (

                    <div
                      key={`${song.title}-${song.artist}`}
                      className="flex items-center gap-3 rounded-xl bg-zinc-800/70 p-2"
                    >

                      {/* MINIATURA */}

                      <img
                        src={`https://i.ytimg.com/vi/${song.youtubeId}/default.jpg`}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />

                      {/* TEXTO */}

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

              {/* SPOTIFY */}

              <button
                disabled={likedSongs.length === 0}
                onClick={() => setSpotifyMessage(true)}
                className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Criar playlist no Spotify
              </button>

              {spotifyMessage && (

                <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-center text-xs text-zinc-300">

                  O Spotify ainda não está conectado.

                  <br />

                  <span className="text-zinc-500">
                    A integração será adicionada na próxima etapa.
                  </span>

                </div>

              )}

            </div>

          </aside>

        </div>

        {/* FOOTER */}

        <footer className="pb-2 text-center text-xs text-zinc-700">
          MusicSwipe • Descoberta musical
        </footer>

      </div>
    </main>
  );
}