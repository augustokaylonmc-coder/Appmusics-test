"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
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

type Preference = {
  value: number;
  manual: boolean;
};

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

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyVersion(
  title: string,
  description = ""
): VersionKey {
  const text = normalize(`${title} ${description}`);

  if (/\b(slowed|slowed reverb|reverb)\b/.test(text)) {
    return "slowed";
  }

  if (
    /\b(sped up|speed up|speedup|sped-up|nightcore)\b/.test(text)
  ) {
    return "speedup";
  }

  if (
    /\b(instrumental|karaoke|backing track|no vocals)\b/.test(text)
  ) {
    return "instrumental";
  }

  if (/\b(cover|covered by|cover version)\b/.test(text)) {
    return "cover";
  }

  if (
    /\b(live|ao vivo|concert|festival|performance)\b/.test(text)
  ) {
    return "live";
  }

  if (
    /\b(remix|rework|bootleg|mashup|edit|flip)\b/.test(text)
  ) {
    return "remix";
  }

  return "original";
}

function resultToSong(item: any): Song | null {
  const id = item?.id?.videoId;
  const snippet = item?.snippet;

  if (!id || !snippet) {
    return null;
  }

  const title = String(snippet.title ?? "Sem título").replace(
    /<[^>]*>/g,
    ""
  );

  const description = String(snippet.description ?? "");

  return {
    title,
    artist: String(snippet.channelTitle ?? "YouTube"),
    album: "YouTube",
    match: 50,
    youtubeId: id,
    thumbnail:
      snippet.thumbnails?.high?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.default?.url ??
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    channel: String(snippet.channelTitle ?? "YouTube"),
    version: classifyVersion(title, description),
    description,
  };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${remaining
    .toString()
    .padStart(2, "0")}`;
}

export default function Home() {
  const apiKey =
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY ?? "";

  const [mode, setMode] = useState<"setup" | "discover">(
    "setup"
  );

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [selected, setSelected] = useState<Song[]>([]);

  const [preferences, setPreferences] = useState(
    INITIAL_PREFERENCES
  );

  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [passedSongs, setPassedSongs] = useState<Song[]>([]);

  const [seenIds, setSeenIds] = useState<string[]>([]);

  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);

  const [searching, setSearching] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] =
    useState(false);

  const [error, setError] = useState("");

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<any>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);
  const timerRef =
    useRef<ReturnType<typeof setInterval> | null>(null);

  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(0);

  const preferencesRef = useRef(preferences);
  const likedRef = useRef(likedSongs);
  const passedRef = useRef(passedSongs);
  const selectedRef = useRef(selected);
  const seenRef = useRef(seenIds);

  const recommendationBusyRef = useRef(false);

  const currentSong = queue[index];

  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = index;
  }, [queue, index]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    likedRef.current = likedSongs;
  }, [likedSongs]);

  useEffect(() => {
    passedRef.current = passedSongs;
  }, [passedSongs]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    seenRef.current = seenIds;
  }, [seenIds]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();

    timerRef.current = setInterval(() => {
      try {
        if (!playerRef.current) {
          return;
        }

        const time = playerRef.current.getCurrentTime();
        const total = playerRef.current.getDuration();

        if (Number.isFinite(time)) {
          setCurrentTime(time);
        }

        if (Number.isFinite(total) && total > 0) {
          setDuration(total);
        }
      } catch {}
    }, 250);
  }

  async function youtubeSearch(
    query: string,
    maxResults = 10
  ): Promise<Song[]> {
    if (!apiKey) {
      throw new Error(
        "Configure a chave da YouTube Data API."
      );
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "strict",
      maxResults: String(Math.min(maxResults, 50)),
      regionCode: "BR",
      relevanceLanguage: "pt",
      topicId: "/m/04rlf",
      key: apiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ??
          "Erro na busca do YouTube."
      );
    }

    return (data.items ?? [])
      .map(resultToSong)
      .filter(Boolean) as Song[];
  }

  async function handleSearch(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!search.trim()) {
      return;
    }

    setSearching(true);
    setError("");

    try {
      const found = await youtubeSearch(
        search.trim(),
        10
      );

      setResults(found);

      if (!found.length) {
        setError("Nenhum resultado encontrado.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao pesquisar."
      );
    } finally {
      setSearching(false);
    }
  }

  function toggleSelected(song: Song) {
    setSelected((current) => {
      const exists = current.some(
        (item) => item.youtubeId === song.youtubeId
      );

      if (exists) {
        return current.filter(
          (item) => item.youtubeId !== song.youtubeId
        );
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, song];
    });
  }

  function updateVersionPreference(
    version: VersionKey,
    liked: boolean
  ) {
    const next = {
      ...preferencesRef.current,
    };

    if (!next[version].manual) {
      next[version] = {
        value: clamp(
          next[version].value +
            (liked ? 8 : -7)
        ),
        manual: false,
      };
    }

    setPreferences(next);
    preferencesRef.current = next;

    return next;
  }

  function learnFromSeeds(seeds: Song[]) {
    const next = {
      ...preferencesRef.current,
    };

    for (const song of seeds) {
      if (!next[song.version].manual) {
        next[song.version] = {
          value: clamp(
            next[song.version].value + 8
          ),
          manual: false,
        };
      }
    }

    setPreferences(next);
    preferencesRef.current = next;

    return next;
  }

  function getPreferredVersion(
    prefs: Record<VersionKey, Preference>
  ) {
    return [...VERSION_KEYS].sort(
      (a, b) =>
        prefs[b].value - prefs[a].value
    )[0];
  }

  function versionSearchTerm(
    version: VersionKey
  ) {
    return {
      remix: "remix",
      original: "official audio",
      live: "live performance",
      cover: "cover",
      slowed: "slowed reverb",
      speedup: "sped up",
      instrumental: "instrumental",
    }[version];
  }

  function calculateSimilarity(
    candidate: Song,
    seeds: Song[],
    prefs: Record<VersionKey, Preference>
  ) {
    const candidateArtist =
      normalize(candidate.artist);

    const candidateTitleWords = new Set(
      normalize(candidate.title)
        .split(" ")
        .filter((word) => word.length >= 3)
    );

    let bestScore = 0;

    for (const seed of seeds) {
      const seedArtist = normalize(seed.artist);
      const seedTitleWords = normalize(seed.title)
        .split(" ")
        .filter((word) => word.length >= 3);

      let score = 0;

      if (candidateArtist === seedArtist) {
        score += 35;
      } else if (
        candidateArtist.includes(seedArtist) ||
        seedArtist.includes(candidateArtist)
      ) {
        score += 20;
      }

      let commonWords = 0;

      for (const word of seedTitleWords) {
        if (candidateTitleWords.has(word)) {
          commonWords++;
        }
      }

      score += Math.min(
        25,
        commonWords * 7
      );

      if (
        candidate.version ===
        seed.version
      ) {
        score += 8;
      }

      bestScore = Math.max(
        bestScore,
        score
      );
    }

    const versionPreference =
      prefs[candidate.version].value;

    return (
      bestScore +
      versionPreference * 0.45
    );
  }

  function calculateCandidateScore(
    candidate: Song,
    seeds: Song[],
    prefs: Record<VersionKey, Preference>,
    allCandidates: Song[]
  ) {
    let score = calculateSimilarity(
      candidate,
      seeds,
      prefs
    );

    const artist = normalize(
      candidate.artist
    );

    const sameArtistCount =
      allCandidates.filter(
        (song) =>
          normalize(song.artist) === artist
      ).length;

    score -= Math.min(
      25,
      Math.max(0, sameArtistCount - 1) * 7
    );

    const alreadyLikedArtist =
      likedRef.current.some(
        (song) =>
          normalize(song.artist) === artist
      );

    if (alreadyLikedArtist) {
      score += 12;
    }

    const passedArtist =
      passedRef.current.some(
        (song) =>
          normalize(song.artist) === artist
      );

    if (passedArtist) {
      score -= 18;
    }

    // Pequena exploração para não deixar o algoritmo
    // sempre escolher exatamente os mesmos resultados.
    score += Math.random() * 15;

    return score;
  }

  async function searchRecommendationCandidates(
    seeds: Song[],
    prefs: Record<VersionKey, Preference>
  ) {
    const preferredVersion =
      getPreferredVersion(prefs);

    const queries: string[] = [];

    /*
      IMPORTANTE:

      Não pesquisamos mais:
      "artista + música + remix"

      Isso fazia o YouTube devolver:
      mesma música remix
      mesma música slowed
      mesma música live

      Agora usamos principalmente o ARTISTA,
      termos gerais e exploração.
    */

    for (const seed of seeds.slice(-6)) {
      const artist = normalize(
        seed.artist
      );

      queries.push(
        `${artist} songs -${normalize(seed.title)}`
      );

      queries.push(
        `${artist} music ${versionSearchTerm(
          preferredVersion
        )} -${normalize(seed.title)}`
      );
    }

    const artists = seeds
      .map((song) =>
        normalize(song.artist)
      )
      .filter(Boolean)
      .slice(0, 4);

    if (artists.length) {
      queries.push(
        `songs similar to ${artists.join(
          " "
        )} ${versionSearchTerm(
          preferredVersion
        )}`
      );
    }

    /*
      Busca mais aberta para aumentar a descoberta
      de artistas diferentes.
    */
    queries.push(
      `new music similar to ${artists
        .slice(0, 3)
        .join(" ")}`
    );

    const uniqueQueries = [
      ...new Set(queries),
    ].slice(0, 5);

    const batches = await Promise.all(
      uniqueQueries.map((query) =>
        youtubeSearch(query, 10)
      )
    );

    return batches.flat();
  }

  async function getRecommendations(
    seeds: Song[],
    prefs: Record<VersionKey, Preference>,
    excludedIds: string[]
  ) {
    if (
      !apiKey ||
      recommendationBusyRef.current
    ) {
      return [];
    }

    recommendationBusyRef.current = true;
    setLoadingRecommendations(true);

    try {
      const excluded =
        new Set(excludedIds);

      const rawCandidates =
        await searchRecommendationCandidates(
          seeds,
          prefs
        );

      /*
        Remove duplicatas e tudo que já apareceu.
      */
      const uniqueMap =
        new Map<string, Song>();

      for (const song of rawCandidates) {
        if (
          excluded.has(song.youtubeId)
        ) {
          continue;
        }

        uniqueMap.set(
          song.youtubeId,
          song
        );
      }

      const candidates = [
        ...uniqueMap.values(),
      ];

      /*
        Primeiro fazemos o ranking.
      */
      const ranked = candidates
        .map((song) => ({
          song,
          score:
            calculateCandidateScore(
              song,
              seeds,
              prefs,
              candidates
            ),
        }))
        .sort(
          (a, b) =>
            b.score - a.score
        );

      /*
        Depois limitamos a quantidade do mesmo artista.
      */
      const artistCount =
        new Map<string, number>();

      const recommendations: Song[] = [];

      for (const item of ranked) {
        const artist = normalize(
          item.song.artist
        );

        const count =
          artistCount.get(artist) ?? 0;

        if (count >= 2) {
          continue;
        }

        recommendations.push({
          ...item.song,
          match: Math.round(
            clamp(item.score)
          ),
        });

        artistCount.set(
          artist,
          count + 1
        );

        if (
          recommendations.length >= 10
        ) {
          break;
        }
      }

      return recommendations;
    } finally {
      recommendationBusyRef.current =
        false;

      setLoadingRecommendations(false);
    }
  }

  async function startDiscovery() {
    if (selected.length !== 4) {
      return;
    }

    /*
      As 4 músicas participam do perfil inicial.
    */
    const seededPreferences =
      learnFromSeeds(selected);

    const initialSeen =
      selected.map(
        (song) => song.youtubeId
      );

    setSeenIds(initialSeen);
    seenRef.current = initialSeen;

    const recommendations =
      await getRecommendations(
        selected,
        seededPreferences,
        initialSeen
      );

    setQueue(recommendations);
    queueRef.current =
      recommendations;

    setIndex(0);
    indexRef.current = 0;

    setLikedSongs([]);
    likedRef.current = [];

    setPassedSongs([]);
    passedRef.current = [];

    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);

    setMode("discover");
  }

  async function advance(
    liked: boolean
  ) {
    const song =
      queueRef.current[
        indexRef.current
      ];

    if (!song) {
      return;
    }

    /*
      Aprende imediatamente com a escolha.
    */
    const nextPreferences =
      updateVersionPreference(
        song.version,
        liked
      );

    if (liked) {
      if (
        !likedRef.current.some(
          (item) =>
            item.youtubeId ===
            song.youtubeId
        )
      ) {
        const nextLiked = [
          ...likedRef.current,
          song,
        ];

        setLikedSongs(nextLiked);
        likedRef.current =
          nextLiked;
      }
    } else {
      const nextPassed = [
        ...passedRef.current,
        song,
      ];

      setPassedSongs(nextPassed);
      passedRef.current =
        nextPassed;
    }

    /*
      Essa música nunca volta para a fila.
    */
    const nextSeen = [
      ...new Set([
        ...seenRef.current,
        song.youtubeId,
      ]),
    ];

    setSeenIds(nextSeen);
    seenRef.current = nextSeen;

    const nextIndex =
      indexRef.current + 1;

    /*
      Ainda existem músicas na fila.
    */
    if (
      nextIndex <
      queueRef.current.length
    ) {
      setIndex(nextIndex);
      indexRef.current =
        nextIndex;

      /*
        Quando restarem poucas músicas,
        buscamos mais usando o aprendizado
        mais recente.
      */
      if (
        queueRef.current.length -
          nextIndex <=
        3
      ) {
        const seeds = [
          ...selectedRef.current,
          ...likedRef.current.slice(-5),
        ].slice(-8);

        const additions =
          await getRecommendations(
            seeds,
            nextPreferences,
            seenRef.current
          );

        const seenSet =
          new Set(seenRef.current);

        const newSongs =
          additions.filter(
            (item) =>
              !seenSet.has(
                item.youtubeId
              )
          );

        if (newSongs.length) {
          const nextQueue = [
            ...queueRef.current,
            ...newSongs,
          ];

          setQueue(nextQueue);
          queueRef.current =
            nextQueue;

          const expandedSeen = [
            ...seenRef.current,
            ...newSongs.map(
              (song) =>
                song.youtubeId
            ),
          ];

          setSeenIds(
            expandedSeen
          );

          seenRef.current =
            expandedSeen;
        }
      }

      return;
    }

    /*
      A fila terminou.
      Criamos uma nova usando todo o aprendizado.
    */
    const seeds = [
      ...selectedRef.current,
      ...likedRef.current.slice(-6),
    ].slice(-10);

    const additions =
      await getRecommendations(
        seeds,
        nextPreferences,
        seenRef.current
      );

    if (additions.length) {
      const firstNewIndex =
        queueRef.current.length;

      const nextQueue = [
        ...queueRef.current,
        ...additions,
      ];

      setQueue(nextQueue);
      queueRef.current =
        nextQueue;

      setIndex(
        firstNewIndex
      );

      indexRef.current =
        firstNewIndex;

      const expandedSeen = [
        ...seenRef.current,
        ...additions.map(
          (song) =>
            song.youtubeId
        ),
      ];

      setSeenIds(
        expandedSeen
      );

      seenRef.current =
        expandedSeen;
    }
  }

  async function likeSong() {
    await advance(true);
  }

  async function passSong() {
    await advance(false);
  }

  function setManualPreference(
    key: VersionKey,
    value: number
  ) {
    const next = {
      ...preferencesRef.current,
      [key]: {
        value: clamp(value),
        manual: true,
      },
    };

    setPreferences(next);
    preferencesRef.current =
      next;
  }

  function resetAutomaticPreferences() {
    const next = {
      ...preferencesRef.current,
    };

    for (const key of VERSION_KEYS) {
      next[key] = {
        ...next[key],
        manual: false,
      };
    }

    setPreferences(next);
    preferencesRef.current =
      next;
  }

  /*
    YouTube IFrame Player.
  */
  useEffect(() => {
    if (mode !== "discover") {
      return;
    }

    const createPlayer = () => {
      if (
        !playerHostRef.current ||
        !window.YT?.Player ||
        playerRef.current ||
        !queueRef.current[0]
      ) {
        return;
      }

      playerRef.current =
        new window.YT.Player(
          playerHostRef.current,
          {
            width: "100%",
            height: "100%",
            videoId:
              queueRef.current[0]
                .youtubeId,
            playerVars: {
              playsinline: 1,
              controls: 0,
              rel: 0,
              iv_load_policy: 3,
              disablekb: 1,
            },
            events: {
              onReady: (event: any) => {
                const total =
                  event.target.getDuration();

                if (
                  Number.isFinite(total)
                ) {
                  setDuration(total);
                }
              },

              onStateChange: (
                event: any
              ) => {
                if (
                  event.data ===
                  window.YT
                    .PlayerState
                    .PLAYING
                ) {
                  setPlaying(true);
                  startTimer();
                } else if (
                  event.data ===
                  window.YT
                    .PlayerState
                    .PAUSED
                ) {
                  setPlaying(false);
                  stopTimer();
                } else if (
                  event.data ===
                  window.YT
                    .PlayerState
                    .ENDED
                ) {
                  setPlaying(false);
                  stopTimer();
                  void advance(false);
                }
              },
            },
          }
        );
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      window.onYouTubeIframeAPIReady =
        createPlayer;

      if (
        !document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        )
      ) {
        const script =
          document.createElement(
            "script"
          );

        script.src =
          "https://www.youtube.com/iframe_api";

        script.async = true;

        document.body.appendChild(
          script
        );
      }
    }

    return () => {
      stopTimer();

      try {
        playerRef.current?.destroy();
      } catch {}

      playerRef.current = null;
    };
  }, [mode]);

  /*
    Troca o vídeo quando muda a música.
  */
  useEffect(() => {
    if (
      !playerRef.current ||
      !currentSong
    ) {
      return;
    }

    try {
      playerRef.current.loadVideoById(
        currentSong.youtubeId
      );

      setCurrentTime(0);
      setDuration(0);
      setPlaying(false);

      stopTimer();
    } catch {}
  }, [index]);

  function togglePlay() {
    if (
      !playerRef.current ||
      !window.YT
    ) {
      return;
    }

    try {
      const state =
        playerRef.current.getPlayerState();

      if (
        state ===
        window.YT.PlayerState.PLAYING
      ) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch {}
  }

  function seek(
    event: MouseEvent<HTMLDivElement>
  ) {
    if (
      !playerRef.current ||
      duration <= 0
    ) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const percentage = clamp(
      ((event.clientX -
        rect.left) /
        rect.width) *
        100
    );

    const newTime =
      (percentage / 100) *
      duration;

    try {
      playerRef.current.seekTo(
        newTime,
        true
      );

      setCurrentTime(newTime);
    } catch {}
  }

  /*
    TELA INICIAL
  */
  if (mode === "setup") {
    return (
      <main className="min-h-screen bg-[#09090b] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">
              Music
              <span className="text-pink-500">
                Swipe
              </span>
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Descubra músicas que combinam
              com você
            </p>
          </header>

          <section className="flex flex-1 flex-col justify-center py-10">
            <div className="mb-8 text-center">
              <p className="text-sm font-medium text-pink-400">
                Primeiro passo
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                Escolha 4 músicas que você
                gosta
              </h2>

              <p className="mx-auto mt-3 max-w-xl text-zinc-500">
                Essas músicas são o ponto de
                partida. Depois, seus Likes e
                Passes ensinam o algoritmo.
              </p>
            </div>

            <form
              onSubmit={handleSearch}
              className="mx-auto flex w-full max-w-2xl gap-3"
            >
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Pesquise uma música, artista ou álbum..."
                className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 outline-none placeholder:text-zinc-600 focus:border-pink-500"
              />

              <button
                type="submit"
                disabled={searching}
                className="rounded-2xl bg-pink-500 px-6 font-semibold text-black transition hover:bg-pink-400 disabled:opacity-50"
              >
                {searching
                  ? "..."
                  : "Pesquisar"}
              </button>
            </form>

            {!apiKey && (
              <p className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-sm text-amber-300">
                Configure
                NEXT_PUBLIC_YOUTUBE_API_KEY
                no .env.local.
              </p>
            )}

            {error && (
              <p className="mt-4 text-center text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-8 grid gap-3">
              {results.map((song) => {
                const isSelected =
                  selected.some(
                    (item) =>
                      item.youtubeId ===
                      song.youtubeId
                  );

                return (
                  <button
                    key={
                      song.youtubeId
                    }
                    type="button"
                    onClick={() =>
                      toggleSelected(song)
                    }
                    className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? "border-pink-500 bg-pink-500/10"
                        : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700"
                    }`}
                  >
                    <img
                      src={
                        song.thumbnail
                      }
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
                        {
                          VERSION_LABELS[
                            song.version
                          ]
                        }
                      </span>
                    </span>

                    <span
                      className={`rounded-full px-3 py-2 text-xs font-semibold ${
                        isSelected
                          ? "bg-pink-500 text-black"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {isSelected
                        ? "Selecionada"
                        : "Selecionar"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-zinc-500">
                {selected.length}/4
                selecionadas
              </p>

              <button
                type="button"
                disabled={
                  selected.length !==
                    4 ||
                  loadingRecommendations
                }
                onClick={() =>
                  void startDiscovery()
                }
                className="rounded-full bg-pink-500 px-8 py-4 font-bold text-black shadow-lg shadow-pink-500/20 transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {loadingRecommendations
                  ? "Montando recomendações..."
                  : "Começar a descobrir"}
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

  /*
    SEM RECOMENDAÇÕES
  */
  if (!currentSong) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#09090b] text-white">
        <div className="text-center">
          <p className="text-zinc-400">
            Não encontramos recomendações
            suficientes.
          </p>

          <button
            type="button"
            onClick={() =>
              setMode("setup")
            }
            className="mt-4 rounded-full bg-pink-500 px-5 py-3 font-semibold text-black"
          >
            Voltar para a busca
          </button>
        </div>
      </main>
    );
  }

  const progress =
    duration > 0
      ? clamp(
          (currentTime /
            duration) *
            100
        )
      : 0;

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Music
              <span className="text-pink-500">
                Swipe
              </span>
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              Descubra músicas que combinam
              com você
            </p>
          </div>

          <div className="rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300">
            ❤️ {likedSongs.length} curtidas
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 xl:flex-row">
          {/* PREFERÊNCIAS */}

          <aside className="order-2 w-full max-w-sm xl:order-1 xl:w-64">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    Preferências
                  </h3>

                  <p className="mt-1 text-xs text-zinc-500">
                    Aprendidas automaticamente
                    pelos seus Likes e Passes.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    resetAutomaticPreferences
                  }
                  className="text-xs text-zinc-500 hover:text-white"
                >
                  Automático
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {VERSION_KEYS.map(
                  (key) => {
                    const preference =
                      preferences[key];

                    return (
                      <div key={key}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm text-zinc-300">
                            {
                              VERSION_LABELS[
                                key
                              ]
                            }
                          </span>

                          <span className="text-xs text-zinc-500">
                            {Math.round(
                              preference.value
                            )}
                            %
                          </span>
                        </div>

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={
                            preference.value
                          }
                          onChange={(
                            event
                          ) =>
                            setManualPreference(
                              key,
                              Number(
                                event
                                  .target
                                  .value
                              )
                            )
                          }
                          className="w-full accent-pink-500"
                        />

                        {preference.manual && (
                          <span className="text-[10px] text-pink-400">
                            Manual
                          </span>
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              <div className="mt-5 rounded-xl bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-500">
                Essas preferências influenciam
                quais versões aparecem. Elas
                mudam automaticamente conforme
                você usa o MusicSwipe.
              </div>
            </div>
          </aside>

          {/* CARD PRINCIPAL */}

          <section className="order-1 w-full max-w-sm xl:order-2">
            <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              <div className="relative aspect-square w-full overflow-hidden bg-black">
                <div
                  ref={
                    playerHostRef
                  }
                  className="absolute inset-0 h-full w-full"
                />

                <div className="absolute left-4 top-4 z-30 rounded-full bg-black/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  {currentSong.match}%
                  compatível
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-6 pb-5 pt-32">
                  <p className="text-sm text-zinc-300">
                    {
                      VERSION_LABELS[
                        currentSong
                          .version
                      ]
                    }
                  </p>

                  <h2 className="mt-1 text-3xl font-bold leading-tight">
                    {
                      currentSong.title
                    }
                  </h2>

                  <p className="mt-1 text-lg text-zinc-300">
                    {
                      currentSong.artist
                    }
                  </p>
                </div>
              </div>

              {/* PROGRESSO */}

              <div className="px-5 pt-5">
                <div
                  onClick={seek}
                  className="group flex h-5 cursor-pointer items-center"
                >
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-700 transition-all group-hover:h-2">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-pink-500"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>
                    {formatTime(
                      currentTime
                    )}
                  </span>

                  <span>
                    {formatTime(
                      duration
                    )}
                  </span>
                </div>
              </div>

              {/* PLAY */}

              <div className="px-5 py-5">
                <button
                  type="button"
                  onClick={
                    togglePlay
                  }
                  aria-label={
                    playing
                      ? "Pausar"
                      : "Reproduzir"
                  }
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl text-black shadow-lg transition hover:scale-105"
                >
                  {playing
                    ? "❚❚"
                    : "▶"}
                </button>
              </div>
            </div>

            {/* BOTÕES */}

            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() =>
                  void passSong()
                }
                aria-label="Passar"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110 hover:border-red-500"
              >
                ❌
              </button>

              <button
                type="button"
                onClick={() =>
                  void likeSong()
                }
                aria-label="Curtir"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-3xl shadow-lg shadow-pink-500/20 transition hover:scale-110 hover:bg-pink-400"
              >
                ❤️
              </button>

              <button
                type="button"
                onClick={() =>
                  void passSong()
                }
                aria-label="Próxima"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl transition hover:scale-110"
              >
                ⏭️
              </button>
            </div>

            {loadingRecommendations && (
              <p className="mt-4 text-center text-xs text-zinc-600">
                Encontrando músicas diferentes...
              </p>
            )}
          </section>

          {/* CURTIDAS */}

          <aside className="order-3 w-full max-w-sm xl:w-80">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Suas curtidas
                </h3>

                <span className="text-sm text-zinc-500">
                  {likedSongs.length}
                </span>
              </div>

              {likedSongs.length ===
              0 ? (
                <div className="py-12 text-center">
                  <div className="text-4xl">
                    🎵
                  </div>

                  <p className="mt-3 text-sm text-zinc-400">
                    Suas músicas curtidas
                    aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {likedSongs.map(
                    (song) => (
                      <div
                        key={
                          song.youtubeId
                        }
                        className="flex items-center gap-3 rounded-xl bg-zinc-800/70 p-2"
                      >
                        <img
                          src={
                            song.thumbnail
                          }
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {
                              song.title
                            }
                          </p>

                          <p className="truncate text-xs text-zinc-500">
                            {
                              song.artist
                            }
                          </p>

                          <p className="text-[10px] text-zinc-600">
                            {
                              VERSION_LABELS[
                                song.version
                              ]
                            }
                          </p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {passedSongs.length >
              0 && (
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                <p className="text-xs text-zinc-500">
                  {passedSongs.length}{" "}
                  músicas analisadas
                </p>

                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Seus Passes também
                  influenciam as próximas
                  recomendações.
                </p>
              </div>
            )}
          </aside>
        </div>

        <footer className="pb-2 text-center text-xs text-zinc-700">
          MusicSwipe • Descoberta musical
        </footer>
      </div>
    </main>
  );
}