"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

type VersionKey =
  | "remix"
  | "original"
  | "live"
  | "cover"
  | "slowed"
  | "speedup"
  | "instrumental";

type Preference = { value: number; manual: boolean };

type Song = {
  title: string;
  artist: string;
  album: string;
  match: number;
  youtubeId: string;
  thumbnail: string;
  channel: string;
  version: VersionKey;
  description?: string;
};

const VERSION_LABELS: Record<VersionKey, string> = {
  remix: "Remix",
  original: "Original",
  live: "Live",
  cover: "Cover",
  slowed: "Slowed",
  speedup: "Speed Up",
  instrumental: "Instrumental",
};

const VERSION_KEYS: VersionKey[] = [
  "remix",
  "original",
  "live",
  "cover",
  "slowed",
  "speedup",
  "instrumental",
];

const INITIAL_PREFERENCES: Record<VersionKey, Preference> = {
  remix: { value: 50, manual: false },
  original: { value: 50, manual: false },
  live: { value: 50, manual: false },
  cover: { value: 50, manual: false },
  slowed: { value: 50, manual: false },
  speedup: { value: 50, manual: false },
  instrumental: { value: 50, manual: false },
};

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}

function classifyVersion(title: string, description = ""): VersionKey {
  const text = `${title} ${description}`.toLowerCase();

  if (/\b(slowed|slowed\s*\+\s*reverb|reverb)\b/.test(text)) return "slowed";
  if (/\b(sped\s*up|speed\s*up|speedup|sped-up|nightcore)\b/.test(text))
    return "speedup";
  if (/\b(instrumental|karaoke|backing\s*track|no\s*vocals)\b/.test(text))
    return "instrumental";
  if (/\b(cover|covered\s*by|cover\s*version)\b/.test(text)) return "cover";
  if (/\b(live|ao\s*vivo|concert|festival|performance)\b/.test(text))
    return "live";
  if (/\b(remix|rework|bootleg|mashup|edit|flip)\b/.test(text)) return "remix";

  return "original";
}

function resultToSong(item: any): Song | null {
  const id = item?.id?.videoId;
  const s = item?.snippet;
  if (!id || !s) return null;

  const title = String(s.title ?? "Sem título").replace(/<[^>]*>/g, "");
  const description = String(s.description ?? "");
  const thumbnail =
    s.thumbnails?.high?.url ??
    s.thumbnails?.medium?.url ??
    s.thumbnails?.default?.url ??
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

  return {
    title,
    artist: String(s.channelTitle ?? "YouTube"),
    album: "YouTube",
    match: 50,
    youtubeId: id,
    thumbnail,
    channel: String(s.channelTitle ?? "YouTube"),
    version: classifyVersion(title, description),
    description,
  };
}

// Reconhece versões diferentes como a mesma música-base.
// Ex.: "Blinding Lights", "Blinding Lights Remix" e
// "Blinding Lights Slowed + Reverb" compartilham a mesma chave.
function baseSongKey(song: Song) {
  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(
        /\b(slowed|reverb|sped\s*up|speed\s*up|speedup|sped-up|nightcore|remix|rework|bootleg|mashup|edit|flip|cover|live|ao\s*vivo|concert|festival|performance|instrumental|karaoke|official\s*(audio|video|music video)|lyrics?|visualizer|audio|video|hd|hq)\b/gi,
        " "
      )
      .replace(/[^a-z0-9áéíóúàâêôãõçñ]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  return `${clean(song.artist)}::${clean(song.title)}`;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secondsLeft = Math.floor(seconds % 60);
  return `${minutes}:${secondsLeft.toString().padStart(2, "0")}`;
}

export default function Home() {
  const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";

  const [mode, setMode] = useState<"setup" | "discover">("setup");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [preferences, setPreferences] =
    useState<Record<VersionKey, Preference>>(INITIAL_PREFERENCES);
  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(0);
  const searchingMoreRef = useRef(false);
  const preferencesRef = useRef(preferences);
  const likedSongsRef = useRef(likedSongs);
  const selectedRef = useRef(selected);
  const recentSongKeysRef = useRef<string[]>([]);

  const currentSong = queue[index];

  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = index;
  }, [queue, index]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    likedSongsRef.current = likedSongs;
  }, [likedSongs]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  function rememberSong(song: Song) {
    const key = baseSongKey(song);
    if (!key) return;

    recentSongKeysRef.current = [
      ...recentSongKeysRef.current.filter((item) => item !== key),
      key,
    ].slice(-10);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || !readyRef.current) return;

      try {
        const time = player.getCurrentTime();
        const total = player.getDuration();
        if (Number.isFinite(time)) setCurrentTime(time);
        if (Number.isFinite(total) && total > 0) setDuration(total);
      } catch {}
    }, 250);
  }

  async function youtubeSearch(query: string): Promise<Song[]> {
    if (!apiKey) throw new Error("Configure a chave da YouTube Data API.");
    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "strict",
      maxResults: "10",
      regionCode: "BR",
      relevanceLanguage: "pt",
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Erro na busca do YouTube.");
    }

    return (data.items ?? [])
      .map(resultToSong)
      .filter(Boolean) as Song[];
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.trim()) return;

    setSearching(true);
    setError("");

    try {
      const found = await youtubeSearch(search.trim());
      setResults(found);
      if (!found.length) setError("Nenhum resultado encontrado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao pesquisar.");
    } finally {
      setSearching(false);
    }
  }

  function toggleSelected(song: Song) {
    setSelected((current) => {
      if (current.some((s) => s.youtubeId === song.youtubeId)) {
        return current.filter((s) => s.youtubeId !== song.youtubeId);
      }
      if (current.length >= 4) return current;
      return [...current, song];
    });
  }

  function seedPreferences(seeds: Song[]) {
    setPreferences((current) => {
      const next = { ...current };

      for (const song of seeds) {
        if (!next[song.version].manual) {
          next[song.version] = {
            value: clamp(next[song.version].value + 8),
            manual: false,
          };
        }
      }

      return next;
    });
  }

  function preferenceScore(song: Song, prefs = preferences) {
    return 35 + prefs[song.version].value * 0.65;
  }

  function recommendationQuery(seed: Song, prefs = preferences) {
    const best = VERSION_KEYS
      .map((key) => ({ key, value: prefs[key].value }))
      .sort((a, b) => b.value - a.value)[0];

    const terms: Record<VersionKey, string> = {
      remix: "remix",
      original: "official audio",
      live: "live",
      cover: "cover",
      slowed: "slowed reverb",
      speedup: "sped up",
      instrumental: "instrumental",
    };

    const versionTerm = best.value >= 68 ? terms[best.key] : "";
    return `${seed.artist} ${seed.title} ${versionTerm}`.trim();
  }

  async function getRecommendations(
    profileSongs: Song[],
    prefs: Record<VersionKey, Preference>,
    existing: Song[]
  ) {
    if (!apiKey || searchingMoreRef.current || !profileSongs.length) return [];

    searchingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const seeds = Array.from(
        new Map(profileSongs.map((song) => [baseSongKey(song), song])).values()
      ).slice(-5);

      const foundLists = await Promise.all(
        seeds.map((seed) => youtubeSearch(recommendationQuery(seed, prefs)))
      );

      const found = foundLists.flat();
      const existingIds = new Set(existing.map((s) => s.youtubeId));
      const existingBaseKeys = new Set(existing.map(baseSongKey));
      const profileBaseKeys = new Set(profileSongs.map(baseSongKey));
      const seenIds = new Set<string>();
      const seenBaseKeys = new Set<string>();

      return found
        .filter((song) => {
          const key = baseSongKey(song);
          if (existingIds.has(song.youtubeId)) return false;
          if (existingBaseKeys.has(key)) return false;
          if (profileBaseKeys.has(key)) return false;
          if (seenIds.has(song.youtubeId)) return false;
          if (seenBaseKeys.has(key)) return false;
          seenIds.add(song.youtubeId);
          seenBaseKeys.add(key);
          return true;
        })
        .map((song) => {
          let score = preferenceScore(song, prefs);
          const key = baseSongKey(song);

          if (recentSongKeysRef.current.includes(key)) score -= 80;

          const sameArtistCount = existing.filter(
            (item) => item.artist.trim().toLowerCase() === song.artist.trim().toLowerCase()
          ).length;
          score -= sameArtistCount * 45;

          return {
            ...song,
            match: Math.round(clamp(score)),
            _score: score,
          };
        })
        .sort((a, b) => b._score - a._score)
        .map(({ _score, ...song }) => song);
    } finally {
      searchingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  async function startDiscovery() {
    if (selected.length !== 4) return;

    // As quatro escolhas viram sementes: elas ensinam o algoritmo antes
    // de começarem as recomendações.
    seedPreferences(selected);

    const seededPrefs = { ...preferences };
    for (const song of selected) {
      if (!seededPrefs[song.version].manual) {
        seededPrefs[song.version] = {
          value: clamp(seededPrefs[song.version].value + 8),
          manual: false,
        };
      }
    }

    const recommendations = selected.length
      ? await getRecommendations(selected, seededPrefs, selected)
      : [];

    setQueue(recommendations);
    setIndex(0);
    setLikedSongs([]);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setMode("discover");
  }

  function updateFromFeedback(version: VersionKey, liked: boolean) {
    setPreferences((current) => {
      if (current[version].manual) return current;

      return {
        ...current,
        [version]: {
          value: clamp(current[version].value + (liked ? 8 : -6)),
          manual: false,
        },
      };
    });
  }

  function setManual(
    key: VersionKey,
    event: ChangeEvent<HTMLInputElement>
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: {
        value: clamp(Number(event.target.value)),
        manual: true,
      },
    }));
  }

  function resetManual(key: VersionKey) {
    setPreferences((current) => ({
      ...current,
      [key]: { ...current[key], manual: false },
    }));
  }

  function resetAllManual() {
    setPreferences((current) => {
      const next = { ...current };
      for (const key of VERSION_KEYS) {
        next[key] = { ...next[key], manual: false };
      }
      return next;
    });
  }

  async function nextSong() {
    const current = queueRef.current[indexRef.current];
    if (current) rememberSong(current);

    const nextIndex = indexRef.current + 1;

    if (nextIndex < queueRef.current.length) {
      setIndex(nextIndex);

      if (
        queueRef.current.length - nextIndex <= 3 &&
        currentSong
      ) {
        const profile = [
          ...selectedRef.current,
          ...likedSongsRef.current,
          currentSong,
        ];
        const additions = await getRecommendations(
          profile,
          preferencesRef.current,
          queueRef.current
        );
        if (additions.length) {
          setQueue((current) => {
            const ids = new Set(current.map((s) => s.youtubeId));
            return [
              ...current,
              ...additions.filter((s) => !ids.has(s.youtubeId)),
            ];
          });
        }
      }
      return;
    }

    const profile = [
      ...selectedRef.current,
      ...likedSongsRef.current,
    ];

    if (!profile.length) return;

    const additions = await getRecommendations(
      profile,
      preferencesRef.current,
      queueRef.current
    );

    if (additions.length) {
      const firstNewIndex = queueRef.current.length;
      setQueue((current) => [...current, ...additions]);
      setIndex(firstNewIndex);
    }
  }

  async function likeSong() {
    if (!currentSong) return;

    setLikedSongs((current) =>
      current.some((s) => s.youtubeId === currentSong.youtubeId)
        ? current
        : [...current, currentSong]
    );

    updateFromFeedback(currentSong.version, true);
    await nextSong();
  }

  async function passSong() {
    if (!currentSong) return;
    updateFromFeedback(currentSong.version, false);
    await nextSong();
  }

  function handlePreferenceKeyDown(
    key: VersionKey,
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.stopPropagation();
    }

    if (!preferences[key].manual) {
      setPreferences((current) => ({
        ...current,
        [key]: { ...current[key], manual: true },
      }));
    }
  }

  useEffect(() => {
    if (mode !== "discover") return;

    const createPlayer = () => {
      if (!playerHostRef.current || !window.YT?.Player || playerRef.current)
        return;

      const firstSong = queueRef.current[0];
      if (!firstSong) return;

      playerRef.current = new window.YT.Player(playerHostRef.current, {
        width: "100%",
        height: "100%",
        videoId: firstSong.youtubeId,
        playerVars: {
          playsinline: 1,
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
        },
        events: {
          onReady: (event: any) => {
            readyRef.current = true;
            const total = event.target.getDuration();
            if (Number.isFinite(total)) setDuration(total);
          },
          onStateChange: (event: any) => {
            if (!window.YT?.PlayerState) return;

            if (event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              startTimer();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setPlaying(false);
              stopTimer();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              stopTimer();
              setCurrentTime(0);
              void nextSong();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady = createPlayer;
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      stopTimer();
      readyRef.current = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [mode]);

  useEffect(() => {
    const player = playerRef.current;
    const song = queue[index];

    if (!player || !readyRef.current || !song) return;

    try {
      player.loadVideoById(song.youtubeId);
      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);
      stopTimer();
    } catch {}
  }, [index]);

  function togglePlay() {
    const player = playerRef.current;
    if (!player || !readyRef.current || !window.YT) return;

    try {
      if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
        setPlaying(false);
      } else {
        player.playVideo();
        setPlaying(true);
      }
    } catch {}
  }

  function seek(event: MouseEvent<HTMLDivElement>) {
    if (!playerRef.current || !readyRef.current || duration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percent = clamp((event.clientX - rect.left) / rect.width);
    const newTime = percent * duration;

    try {
      playerRef.current.seekTo(newTime, true);
      setCurrentTime(newTime);
    } catch {}
  }

  const progress = duration > 0 ? clamp((currentTime / duration) * 100) : 0;
  const manualCount = VERSION_KEYS.filter(
    (key) => preferences[key].manual
  ).length;

  if (mode === "setup") {
    return (
      <main className="min-h-screen bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">
              Music<span className="text-pink-500">Swipe</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Descubra músicas que combinam com você
            </p>
          </header>

          <section className="flex flex-1 flex-col justify-center py-10">
            <div className="mb-8 text-center">
              <p className="text-sm font-medium text-pink-400">Primeiro passo</p>
              <h2 className="mt-2 text-3xl font-bold">
                Escolha 4 músicas que você gosta
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-zinc-500">
                Suas escolhas ensinam o MusicSwipe sobre seu gosto e sobre os
                tipos de versão que você prefere.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="mx-auto flex w-full max-w-2xl gap-3"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquise uma música, artista ou álbum..."
                className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-pink-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-2xl bg-pink-500 px-6 font-semibold text-black transition hover:bg-pink-400 disabled:opacity-50"
              >
                {searching ? "..." : "Pesquisar"}
              </button>
            </form>

            {!apiKey && (
              <p className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-300">
                Configure NEXT_PUBLIC_YOUTUBE_API_KEY no .env.local.
              </p>
            )}

            {error && (
              <p className="mt-4 text-center text-sm text-red-400">{error}</p>
            )}

            <div className="mt-8 grid gap-3">
              {results.map((song) => {
                const isSelected = selected.some(
                  (s) => s.youtubeId === song.youtubeId
                );

                return (
                  <button
                    key={song.youtubeId}
                    type="button"
                    onClick={() => toggleSelected(song)}
                    className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700"
                    }`}
                  >
                    <img
                      src={song.thumbnail}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {song.title}
                      </span>
                      <span className="mt-1 block truncate text-sm text-zinc-500">
                        {song.channel}
                      </span>
                      <span className="mt-1 inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                        {VERSION_LABELS[song.version]}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${
                        isSelected
                          ? "bg-pink-500 text-black"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {isSelected ? "Selecionada" : "Selecionar"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-zinc-500">{selected.length}/4 selecionadas</p>
              <button
                type="button"
                disabled={selected.length !== 4}
                onClick={() => void startDiscovery()}
                className="rounded-full bg-pink-500 px-8 py-4 font-bold text-black shadow-lg shadow-pink-500/20 transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Começar a descobrir
              </button>
            </div>
          </section>

          <footer className="pb-2 text-center text-xs text-zinc-700">
            MusicSwipe • Descoberta musical
          </footer>
        </div>
      </main>
    );
  }

  if (!currentSong) {
    return (
      <main className="min-h-screen bg-[#09090b] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-400">
              Não encontramos recomendações suficientes.
            </p>
            <button
              type="button"
              onClick={() => setMode("setup")}
              className="mt-4 rounded-full bg-pink-500 px-5 py-3 font-semibold text-black"
            >
              Voltar para a busca
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
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

        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 xl:flex-row">
          {/* CONTROLE DE VERSÕES */}
          <aside className="order-2 w-full max-w-sm xl:order-1 xl:w-64">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Preferências</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    O algoritmo aprende enquanto você usa.
                  </p>
                </div>
                {manualCount > 0 && (
                  <button
                    type="button"
                    onClick={resetAllManual}
                    className="text-xs text-zinc-500 hover:text-white"
                  >
                    Automático
                  </button>
                )}
              </div>

              <div className="mt-5 space-y-4">
                {VERSION_KEYS.map((key) => {
                  const pref = preferences[key];

                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between">
                        <label
                          htmlFor={`pref-${key}`}
                          className="text-sm text-zinc-300"
                        >
                          {VERSION_LABELS[key]}
                        </label>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] ${
                              pref.manual ? "text-pink-400" : "text-zinc-600"
                            }`}
                          >
                            {pref.manual ? "Manual" : "Auto"}
                          </span>
                          <span className="w-8 text-right text-xs text-zinc-500">
                            {Math.round(pref.value)}%
                          </span>
                        </div>
                      </div>

                      <input
                        id={`pref-${key}`}
                        type="range"
                        min="0"
                        max="100"
                        value={pref.value}
                        onChange={(e) => setManual(key, e)}
                        onKeyDown={(e) => handlePreferenceKeyDown(key, e)}
                        className="w-full accent-pink-500"
                      />

                      {pref.manual && (
                        <button
                          type="button"
                          onClick={() => resetManual(key)}
                          className="mt-1 text-[11px] text-zinc-600 hover:text-pink-400"
                        >
                          ↺ Voltar ao automático
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-500">
                Mude uma barra a qualquer momento. Não precisa recarregar a
                página e os seus Likes continuam salvos.
              </div>
            </div>
          </aside>

          {/* CARD PRINCIPAL */}
          <section className="order-1 w-full max-w-sm xl:order-2">
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              <div className="relative aspect-square w-full overflow-hidden bg-black">
                <div
                  ref={playerHostRef}
                  className="absolute inset-0 h-full w-full"
                />
                <div className="absolute inset-0 z-10" />

                <div className="absolute left-4 top-4 z-30 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  {currentSong.match}% compatível
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-5 pt-32">
                  <p className="text-sm text-zinc-300">
                    {VERSION_LABELS[currentSong.version]}
                  </p>
                  <h2 className="mt-1 text-3xl font-bold leading-tight">
                    {currentSong.title}
                  </h2>
                  <p className="mt-1 text-lg text-zinc-300">
                    {currentSong.artist}
                  </p>
                </div>
              </div>

              <div className="px-5 pt-5">
                <div
                  onClick={seek}
                  className="group flex h-5 cursor-pointer items-center"
                >
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-700 transition-all group-hover:h-2">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-pink-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="px-5 py-5">
                <button
                  onClick={togglePlay}
                  aria-label={playing ? "Pausar" : "Reproduzir"}
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black shadow-lg transition hover:scale-105"
                >
                  {playing ? "❚❚" : "▶"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={() => void passSong()}
                aria-label="Passar"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-red-500"
              >
                ❌
              </button>
              <button
                onClick={() => void likeSong()}
                aria-label="Curtir"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-3xl shadow-lg shadow-pink-500/20 transition hover:scale-110 hover:bg-pink-400"
              >
                ❤️
              </button>
              <button
                onClick={() => void nextSong()}
                aria-label="Próxima"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110"
              >
                ⏭️
              </button>
            </div>

            <p className="mt-5 text-center text-xs text-zinc-600">
              ❌ Passar &nbsp; • &nbsp; ❤️ Curtir &nbsp; • &nbsp; ▶ Play/Pause
            </p>

            {loadingMore && (
              <p className="mt-3 text-center text-xs text-zinc-700">
                Encontrando mais músicas...
              </p>
            )}
          </section>

          {/* CURTIDAS */}
          <aside className="order-3 w-full max-w-sm xl:w-80">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Suas curtidas</h3>
                <span className="text-sm text-zinc-500">{likedSongs.length}</span>
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
                      key={song.youtubeId}
                      className="flex items-center gap-3 rounded-xl bg-zinc-800/70 p-2"
                    >
                      <img
                        src={song.thumbnail}
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
                        <p className="text-[10px] text-zinc-600">
                          {VERSION_LABELS[song.version]}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="pb-2 text-center text-xs text-zinc-700">
          MusicSwipe • Descoberta musical
        </footer>
      </div>
    </main>
  );
}
