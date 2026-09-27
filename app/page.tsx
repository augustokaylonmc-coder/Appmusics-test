"use client";

import { useState } from "react";

type Song = {
  title: string;
  artist: string;
  album: string;
  cover: string;
  match: number;
};

const songs: Song[] = [
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    cover: "https://i.scdn.co/image/ab67616d0000b273efb2d5a8b0e8b7b7c8f5b0a",
    match: 96,
  },
  {
    title: "Midnight City",
    artist: "M83",
    album: "Hurry Up, We're Dreaming",
    cover: "https://i.scdn.co/image/ab67616d0000b273a4c5e7c7c6f7d6b6c8c9d0e1",
    match: 91,
  },
  {
    title: "Instant Crush",
    artist: "Daft Punk",
    album: "Random Access Memories",
    cover: "https://i.scdn.co/image/ab67616d0000b273c6b4b4c2e5a5e2f2c8d9f0a1",
    match: 89,
  },
  {
    title: "Electric Feel",
    artist: "MGMT",
    album: "Oracular Spectacular",
    cover: "https://i.scdn.co/image/ab67616d0000b2736f3c8d6a4f5e9b8c7d6e5f4a",
    match: 87,
  },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);

  const currentSong = songs[currentIndex];

  function nextSong() {
    setPlaying(false);

    if (currentIndex < songs.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      setCurrentIndex(0);
    }
  }

  function likeSong() {
    if (!currentSong) return;

    setLikedSongs((current) => {
      if (current.some((song) => song.title === currentSong.title)) {
        return current;
      }

      return [...current, currentSong];
    });

    nextSong();
  }

  function passSong() {
    nextSong();
  }

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

        {/* CONTENT */}
        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 lg:flex-row lg:items-center">
          {/* MUSIC CARD */}
          <section className="w-full max-w-sm">
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              {/* COVER */}
              <div className="relative aspect-square w-full overflow-hidden bg-zinc-800">
                <img
                  src={currentSong.cover}
                  alt={`Capa do álbum ${currentSong.album}`}
                  className="h-full w-full object-cover"
                />

                <div className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  {currentSong.match}% compatível
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-20">
                  <p className="text-sm text-zinc-300">{currentSong.album}</p>

                  <h2 className="mt-1 text-3xl font-bold">
                    {currentSong.title}
                  </h2>

                  <p className="mt-1 text-lg text-zinc-300">
                    {currentSong.artist}
                  </p>
                </div>
              </div>

              {/* PLAYER */}
              <div className="p-5">
                <div className="mb-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-700">
                    <div className="h-full w-[38%] rounded-full bg-pink-500" />
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-zinc-500">
                    <span>1:24</span>
                    <span>3:42</span>
                  </div>
                </div>

                <button
                  onClick={() => setPlaying(!playing)}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black transition hover:scale-105"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={passSong}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-red-500 hover:bg-red-500/10"
              >
                ❌
              </button>

              <button
                onClick={likeSong}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-3xl shadow-lg shadow-pink-500/20 transition hover:scale-110 hover:bg-pink-400"
              >
                ❤️
              </button>

              <button
                onClick={nextSong}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-zinc-500"
              >
                ⏭️
              </button>
            </div>

            <p className="mt-5 text-center text-xs text-zinc-600">
              ← Passar &nbsp; • &nbsp; → Curtir &nbsp; • &nbsp; Espaço Play/Pause
            </p>
          </section>

          {/* LIKED SONGS */}
          <aside className="w-full max-w-sm lg:w-80">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Suas curtidas</h3>

                <span className="text-sm text-zinc-500">
                  {likedSongs.length}
                </span>
              </div>

              {likedSongs.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl">🎵</div>

                  <p className="mt-3 text-sm text-zinc-400">
                    Suas músicas curtidas aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {likedSongs.map((song) => (
                    <div
                      key={song.title}
                      className="flex items-center gap-3 rounded-xl bg-zinc-800/70 p-2"
                    >
                      <img
                        src={song.cover}
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

              <button
                disabled={likedSongs.length === 0}
                className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Criar playlist no Spotify
              </button>
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