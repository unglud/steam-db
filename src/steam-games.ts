declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};

type OutputMode = "json" | "ndjson";
type SortKey =
  | "discount_asc"
  | "discount_desc"
  | "rating_asc"
  | "rating_desc"
  | "reviews_asc"
  | "reviews_desc"
  | "positive_asc"
  | "positive_desc"
  | "release_asc"
  | "release_desc"
  | "price_asc"
  | "price_desc";

type PlatformName = "win" | "mac" | "linux" | "applesilicon" | "";

type RuntimeConfig = {
  limit: number | null;
  pages: number | null;
  maxCandidates: number | null;
  start: number;
  concurrency: number;
  country: string;
  language: string;
  euroApproximation: EuroApproximationConfig;
  outputMode: OutputMode;
  outputFile: string | null;
  progress: boolean;
  cache: CacheConfig;
};

type EditableFilters = {
  displayOnly: string;
  minDiscount: number;
  minRating: number;
  minRelease: string;
  minReviews: number;
  os: PlatformName;
  sort: SortKey;
  includeTags: number[];
  excludeTags: number[];
  term: string;
};

type ScriptConfig = RuntimeConfig & {
  filters: EditableFilters;
};

type EuroApproximationConfig = {
  myrToEurRate: number;
};

type CacheConfig = {
  enabled: boolean;
  directory: string;
  searchTtlHours: number;
  appDetailsTtlHours: number;
  reviewSummaryTtlHours: number;
};

type OutputWriter = {
  path: string | null;
  write(chunk: string): Promise<void>;
  close(): Promise<void>;
};

type Filters = {
  displayOnly: string;
  minDiscount: number;
  minRating: number;
  minRelease: string;
  minReleaseTime: number;
  minReviews: number;
  os: PlatformName;
  sort: SortKey;
  includeTags: number[];
  excludeTags: number[];
  term: string;
};

type SearchItem = {
  name?: string;
  logo?: string;
};

type SearchResponse = {
  items?: SearchItem[];
};

type PriceOverview = {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
  initial_formatted?: string;
  final_formatted?: string;
};

type StoreDetails = {
  name?: string;
  steam_appid?: number;
  short_description?: string;
  price_overview?: PriceOverview;
  platforms?: {
    windows?: boolean;
    mac?: boolean;
    linux?: boolean;
  };
  release_date?: {
    coming_soon?: boolean;
    date?: string;
  };
  recommendations?: {
    total?: number;
  };
  genres?: Array<{ id?: string; description?: string }>;
};

type AppDetailsResponse = Record<
  string,
  {
    success?: boolean;
    data?: StoreDetails;
  }
>;

type ReviewSummary = {
  review_score?: number;
  review_score_desc?: string;
  total_positive?: number;
  total_negative?: number;
  total_reviews?: number;
};

type ReviewResponse = {
  success?: number;
  query_summary?: ReviewSummary;
};

type Candidate = {
  appid: number;
  name?: string;
};

type GamePrice = {
  currency: string | null;
  initial: number | null;
  final: number | null;
  discountPercent: number;
  initialFormatted: string | null;
  finalFormatted: string | null;
  euroApproximation: GamePriceEuroApproximation;
};

type GamePriceEuroApproximation = {
  currency: "EUR";
  sourceCurrency: string | null;
  sourceToEurRate: number;
  initial: number | null;
  final: number | null;
  initialFormatted: string | null;
  finalFormatted: string | null;
};

type GameReviews = {
  score: number | null;
  scoreDescription: string | null;
  total: number;
  positive: number;
  negative: number;
  positivePercent: number | null;
};

type GameGenre = {
  id: string | null;
  description: string | null;
};

type GameResult = {
  appid: number;
  name: string;
  steamUrl: string;
  description: string | null;
  releaseDate: string | null;
  price: GamePrice;
  reviews: GameReviews;
  recommendations: number | null;
  genres: GameGenre[];
  internal: {
    releaseTimestamp: number | null;
    platforms: {
      windows: boolean;
      mac: boolean;
      linux: boolean;
    };
  };
};

type SerializableGameResult = Omit<GameResult, "internal">;

// Edit this block to change what `pnpm run games` returns.
const SCRIPT_CONFIG: ScriptConfig = {
  country: "MY",
  language: process.env.STEAM_LANG ?? "english",
  euroApproximation: {
    myrToEurRate: 0.2145,
  },
  start: 0,
  pages: null,
  limit: null,
  maxCandidates: null,
  concurrency: 2,
  outputMode: "json",
  outputFile: "steam-games.json",
  progress: true,
  cache: {
    enabled: true,
    directory: ".cache/steam",
    searchTtlHours: 24,
    appDetailsTtlHours: 24,
    reviewSummaryTtlHours: 72,
  },
  filters: {
    displayOnly: "Game",
    minDiscount: 25,
    minRating: 0,
    minRelease: "2000-01-01",
    minReviews: 500,
    os: "mac",
    sort: "positive_desc",
    includeTags: [],
    excludeTags: [1625, 1664, 3799, 3843, 3859, 5537, 7178],
    term: "",
  },
};

const USER_AGENT = "steam-db-ts-script/0.1 (+https://store.steampowered.com)";
const SEARCH_PAGE_SIZE = 50;
const DETAIL_FILTERS = [
  "price_overview",
  "short_description",
  "release_date",
  "platforms",
  "recommendations",
  "name",
  "steam_appid",
  "genres",
].join(",");

async function main(): Promise<void> {
  const config = normalizeRuntimeConfig(SCRIPT_CONFIG);
  const filters = normalizeFilters(SCRIPT_CONFIG.filters);
  const outputWriter = await createOutputWriter(config);
  const warnings: string[] = [];

  try {
    logProgress(config, "Starting Steam search.");
    if (outputWriter.path !== null) {
      logProgress(config, `Writing ${config.outputMode.toUpperCase()} output to ${outputWriter.path}.`);
    }
    if (config.pages === null && config.maxCandidates === null && config.limit === null) {
      logProgress(config, "Full crawl enabled: this can take several minutes and may hit Steam rate limits.");
    }

    if (filters.os === "applesilicon") {
      warnings.push(
        "Steam's public store APIs expose macOS filtering, but not a reliable Apple Silicon-native flag; this query uses os=mac."
      );
    }

    const discoveredCandidates = await fetchSearchCandidates(filters, config);
    const candidates =
      config.maxCandidates === null ? discoveredCandidates : discoveredCandidates.slice(0, config.maxCandidates);
    logProgress(config, `Discovered ${discoveredCandidates.length} candidate(s); processing ${candidates.length}.`);

    const skippedCandidates: string[] = [];
    let processedCandidates = 0;
    const games = await mapConcurrent(candidates, config.concurrency, async (candidate) => {
      try {
        const game = await enrichCandidate(candidate, config);
        if (config.outputMode === "ndjson" && game !== null && matchesFilters(game, filters)) {
          await outputWriter.write(`${JSON.stringify(serializeGame(game))}\n`);
        }
        return game;
      } catch (error) {
        skippedCandidates.push(`${candidate.appid}: ${errorMessage(error).split("\n")[0]}`);
        return null;
      } finally {
        processedCandidates += 1;
        if (processedCandidates === candidates.length || processedCandidates % 25 === 0) {
          logProgress(config, `Processed ${processedCandidates}/${candidates.length} candidate(s).`);
        }
      }
    });

    if (skippedCandidates.length > 0) {
      warnings.push(
        `Skipped ${skippedCandidates.length} candidate(s) after Steam request failures. First errors: ${skippedCandidates
          .slice(0, 3)
          .join(" | ")}`
      );
    }

    const filtered = games
      .filter((game): game is GameResult => game !== null)
      .filter((game) => matchesFilters(game, filters))
      .sort((a, b) => compareGames(a, b, filters.sort));
    const returnedGames = config.limit === null ? filtered : filtered.slice(0, config.limit);
    const outputGames = returnedGames.map(serializeGame);

    const output = {
      generatedAt: new Date().toISOString(),
      source: "search",
      discoveredCandidates: discoveredCandidates.length,
      scannedCandidates: candidates.length,
      returned: returnedGames.length,
      options: serializableOptions(config),
      filters: serializableFilters(filters),
      warnings,
      games: outputGames,
    };

    if (config.outputMode === "json") {
      await outputWriter.write(`${JSON.stringify(output, null, 2)}\n`);
    } else {
      await outputWriter.write(`${JSON.stringify({ type: "summary", ...output, games: undefined })}\n`);
    }
    if (outputWriter.path !== null) {
      logProgress(config, `Finished writing ${outputWriter.path}.`);
    }
  } finally {
    await outputWriter.close();
  }
}

async function createOutputWriter(config: RuntimeConfig): Promise<OutputWriter> {
  if (config.outputFile === null) {
    return {
      path: null,
      write: async (chunk: string) => {
        process.stdout.write(chunk);
      },
      close: async () => {},
    };
  }

  const { mkdir, open } = await import("node:fs/promises");
  const { basename, dirname, extname, join } = await import("node:path");
  const outputDir = dirname(config.outputFile);
  if (outputDir !== ".") {
    await mkdir(outputDir, { recursive: true });
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const path = withNumericSuffix(config.outputFile, attempt, { basename, dirname, extname, join });
    try {
      const file = await open(path, "wx");
      let pendingWrite = Promise.resolve();

      return {
        path,
        write: async (chunk: string) => {
          pendingWrite = pendingWrite.then(() => file.writeFile(chunk));
          await pendingWrite;
        },
        close: async () => {
          await pendingWrite;
          await file.close();
        },
      };
    } catch (error) {
      if (hasErrorCode(error, "EEXIST")) continue;
      throw error;
    }
  }

  throw new Error(`Could not create a non-existing output file for ${config.outputFile}.`);
}

function withNumericSuffix(
  filePath: string,
  suffixNumber: number,
  pathTools: {
    basename(path: string, suffix?: string): string;
    dirname(path: string): string;
    extname(path: string): string;
    join(...paths: string[]): string;
  }
): string {
  if (suffixNumber === 0) return filePath;

  const dir = pathTools.dirname(filePath);
  const ext = pathTools.extname(filePath);
  const name = pathTools.basename(filePath, ext);
  const suffixedFile = `${name}-${suffixNumber}${ext}`;
  return dir === "." ? suffixedFile : pathTools.join(dir, suffixedFile);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function normalizeRuntimeConfig(config: ScriptConfig): RuntimeConfig {
  if (config.limit !== null && (!Number.isFinite(config.limit) || config.limit < 1)) {
    throw new Error("SCRIPT_CONFIG.limit must be a positive number or null.");
  }
  if (config.pages !== null && (!Number.isFinite(config.pages) || config.pages < 1)) {
    throw new Error("SCRIPT_CONFIG.pages must be a positive number or null.");
  }
  if (config.maxCandidates !== null && (!Number.isFinite(config.maxCandidates) || config.maxCandidates < 1)) {
    throw new Error("SCRIPT_CONFIG.maxCandidates must be a positive number or null.");
  }
  if (!Number.isFinite(config.start) || config.start < 0) {
    throw new Error("SCRIPT_CONFIG.start must be zero or a positive number.");
  }
  if (!Number.isFinite(config.concurrency) || config.concurrency < 1 || config.concurrency > 10) {
    throw new Error("SCRIPT_CONFIG.concurrency must be between 1 and 10.");
  }
  if (config.outputMode !== "json" && config.outputMode !== "ndjson") {
    throw new Error('SCRIPT_CONFIG.outputMode must be "json" or "ndjson".');
  }
  if (config.outputFile !== null && config.outputFile.trim() === "") {
    throw new Error("SCRIPT_CONFIG.outputFile must be a file path string or null.");
  }
  if (config.cache.directory.trim() === "") {
    throw new Error("SCRIPT_CONFIG.cache.directory must be a non-empty path.");
  }
  if (!isPositiveNumber(config.cache.searchTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.searchTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.cache.appDetailsTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.appDetailsTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.cache.reviewSummaryTtlHours)) {
    throw new Error("SCRIPT_CONFIG.cache.reviewSummaryTtlHours must be a positive number.");
  }
  if (!isPositiveNumber(config.euroApproximation.myrToEurRate)) {
    throw new Error("SCRIPT_CONFIG.euroApproximation.myrToEurRate must be a positive number.");
  }

  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country.toUpperCase(),
    language: config.language,
    euroApproximation: config.euroApproximation,
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    progress: config.progress,
    cache: config.cache,
  };
}

function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function normalizeFilters(config: EditableFilters): Filters {
  const minRelease = config.minRelease || "1970-01-01";
  const minReleaseTime = Date.parse(`${minRelease}T00:00:00Z`);

  if (!Number.isFinite(minReleaseTime)) {
    throw new Error(`min_release must be an ISO date like 2000-01-01. Got "${minRelease}".`);
  }

  return {
    displayOnly: config.displayOnly,
    minDiscount: config.minDiscount,
    minRating: config.minRating,
    minRelease,
    minReleaseTime,
    minReviews: config.minReviews,
    os: parsePlatform(config.os),
    sort: parseSort(config.sort),
    includeTags: config.includeTags,
    excludeTags: config.excludeTags.map((tag) => Math.abs(tag)),
    term: config.term,
  };
}

function parsePlatform(value: string): PlatformName {
  const normalized = value.toLowerCase();
  if (normalized === "windows") return "win";
  if (normalized === "macos") return "mac";
  if (normalized === "steamos") return "linux";
  if (normalized === "win" || normalized === "mac" || normalized === "linux" || normalized === "applesilicon") {
    return normalized;
  }
  if (normalized === "") return "";

  throw new Error(`Unsupported os "${value}". Use win, mac, linux, or applesilicon.`);
}

function parseSort(value: string): SortKey {
  const supported: SortKey[] = [
    "discount_asc",
    "discount_desc",
    "rating_asc",
    "rating_desc",
    "reviews_asc",
    "reviews_desc",
    "positive_asc",
    "positive_desc",
    "release_asc",
    "release_desc",
    "price_asc",
    "price_desc",
  ];

  if (supported.includes(value as SortKey)) return value as SortKey;
  throw new Error(`Unsupported sort "${value}". Supported sorts: ${supported.join(", ")}.`);
}

async function fetchSearchCandidates(filters: Filters, config: RuntimeConfig): Promise<Candidate[]> {
  const candidates = new Map<number, Candidate>();

  for (let page = 0; config.pages === null || page < config.pages; page += 1) {
    const previousCandidateCount = candidates.size;
    const url = new URL("https://store.steampowered.com/search/results/");
    url.searchParams.set("json", "1");
    url.searchParams.set("ignore_preferences", "1");
    url.searchParams.set("start", String(config.start + page * SEARCH_PAGE_SIZE));

    if (filters.displayOnly.toLowerCase() === "game") {
      url.searchParams.set("category1", "998");
    }

    if (filters.minDiscount > 0) {
      url.searchParams.set("specials", "1");
    }

    const steamSearchOs = toSteamSearchOs(filters.os);
    if (steamSearchOs) {
      url.searchParams.set("os", steamSearchOs);
    }

    if (filters.includeTags.length > 0) {
      url.searchParams.set("tags", filters.includeTags.join(","));
    }

    if (filters.excludeTags.length > 0) {
      url.searchParams.set("untags", filters.excludeTags.join(","));
    }

    if (filters.term) {
      url.searchParams.set("term", filters.term);
    }

    const response = await fetchCachedJson<SearchResponse>(
      config,
      "search",
      url.toString(),
      hoursToMs(config.cache.searchTtlHours),
      () => fetchJson<SearchResponse>(url)
    );
    const items = response.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const appid = extractAppId(item.logo ?? "");
      if (appid === null) continue;
      candidates.set(appid, { appid, name: item.name });
    }
    logProgress(config, `Fetched search page ${page + 1}; found ${candidates.size} unique candidate(s).`);

    if (items.length < SEARCH_PAGE_SIZE || candidates.size === previousCandidateCount) break;
  }

  return [...candidates.values()];
}

function toSteamSearchOs(os: PlatformName): "win" | "mac" | "linux" | null {
  if (os === "applesilicon") return "mac";
  if (os === "win" || os === "mac" || os === "linux") return os;
  return null;
}

function extractAppId(logo: string): number | null {
  const match = logo.match(/\/apps\/(\d+)\//);
  if (!match) return null;

  const appid = Number.parseInt(match[1], 10);
  return Number.isFinite(appid) ? appid : null;
}

async function enrichCandidate(candidate: Candidate, config: RuntimeConfig): Promise<GameResult | null> {
  const [details, reviews] = await Promise.all([
    fetchAppDetails(candidate.appid, config),
    fetchReviewSummary(candidate.appid, config),
  ]);

  if (!details) return null;

  const price = details.price_overview;
  const reviewTotal = reviews.total_reviews ?? 0;
  const positive = reviews.total_positive ?? 0;
  const negative = reviews.total_negative ?? 0;
  const releaseTime = parseSteamReleaseDate(details.release_date?.date ?? null);
  const platforms = {
    windows: details.platforms?.windows ?? false,
    mac: details.platforms?.mac ?? false,
    linux: details.platforms?.linux ?? false,
  };

  return {
    appid: details.steam_appid ?? candidate.appid,
    name: details.name ?? candidate.name ?? String(candidate.appid),
    steamUrl: `https://store.steampowered.com/app/${candidate.appid}/`,
    description: details.short_description ?? null,
    releaseDate: details.release_date?.date ?? null,
    price: {
      currency: price?.currency ?? null,
      initial: price?.initial ?? null,
      final: price?.final ?? null,
      discountPercent: price?.discount_percent ?? 0,
      initialFormatted: price?.initial_formatted ?? null,
      finalFormatted: price?.final_formatted ?? null,
      euroApproximation: approximateEuroPrice(price, config.euroApproximation),
    },
    reviews: {
      score: reviews.review_score ?? null,
      scoreDescription: reviews.review_score_desc ?? null,
      total: reviewTotal,
      positive,
      negative,
      positivePercent: reviewTotal > 0 ? roundPercent((positive / reviewTotal) * 100) : null,
    },
    recommendations: details.recommendations?.total ?? null,
    genres: (details.genres ?? []).map((genre) => ({
      id: genre.id ?? null,
      description: genre.description ?? null,
    })),
    internal: {
      releaseTimestamp: releaseTime,
      platforms,
    },
  };
}

function serializeGame({
  appid,
  name,
  steamUrl,
  description,
  releaseDate,
  price,
  reviews,
  recommendations,
  genres,
}: GameResult): SerializableGameResult {
  return {
    appid,
    name,
    steamUrl,
    description,
    releaseDate,
    price,
    reviews,
    recommendations,
    genres,
  };
}

async function fetchAppDetails(appid: number, config: RuntimeConfig): Promise<StoreDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("filters", DETAIL_FILTERS);
  url.searchParams.set("cc", config.country);
  url.searchParams.set("l", config.language);

  const response = await fetchCachedJson<AppDetailsResponse>(
    config,
    "appdetails",
    url.toString(),
    hoursToMs(config.cache.appDetailsTtlHours),
    () => fetchJson<AppDetailsResponse>(url)
  );
  const app = response[String(appid)];
  if (!app?.success || !app.data) return null;

  return app.data;
}

async function fetchReviewSummary(appid: number, config: RuntimeConfig): Promise<ReviewSummary> {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");

  const response = await fetchCachedJson<ReviewResponse>(
    config,
    "reviews",
    url.toString(),
    hoursToMs(config.cache.reviewSummaryTtlHours),
    () => fetchJson<ReviewResponse>(url)
  );
  return response.query_summary ?? {};
}

async function fetchCachedJson<T>(
  config: RuntimeConfig,
  namespace: "search" | "appdetails" | "reviews",
  key: string,
  ttlMs: number,
  loadFresh: () => Promise<T>
): Promise<T> {
  if (!config.cache.enabled) return loadFresh();

  const filePath = await cacheFilePath(config, namespace, key);
  const cached = await readCache<T>(filePath);
  const now = Date.now();
  if (cached !== null && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await loadFresh();
  await writeCache(filePath, {
    createdAt: now,
    expiresAt: now + ttlMs,
    key,
    data,
  });
  return data;
}

type CacheEntry<T> = {
  createdAt: number;
  expiresAt: number;
  key: string;
  data: T;
};

async function cacheFilePath(config: RuntimeConfig, namespace: string, key: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  const { join } = await import("node:path");
  const digest = createHash("sha256").update(key).digest("hex");
  return join(config.cache.directory, namespace, `${digest}.json`);
}

async function readCache<T>(filePath: string): Promise<CacheEntry<T> | null> {
  const { readFile } = await import("node:fs/promises");
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as CacheEntry<T>;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return null;
    return null;
  }
}

async function writeCache<T>(filePath: string, entry: CacheEntry<T>): Promise<void> {
  const { mkdir, rename, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(tempPath, JSON.stringify(entry));
  await rename(tempPath, filePath);
}

function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

async function fetchJson<T>(url: URL, attempt = 0): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (shouldRetry(response.status) && attempt < 1) {
      await sleep(retryDelayMs(response, attempt));
      return fetchJson<T>(url, attempt + 1);
    }

    throw new Error(`Steam request failed: ${response.status} ${response.statusText} ${redactUrl(url)}\n${body.slice(0, 300)}`);
  }

  return (await response.json()) as T;
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 30000);
  }

  return [1500, 3500, 7000][attempt] ?? 7000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactUrl(url: URL): string {
  const safe = new URL(url);
  if (safe.searchParams.has("key")) safe.searchParams.set("key", "<redacted>");
  return safe.toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function matchesFilters(game: GameResult, filters: Filters): boolean {
  if (hasEarlyAccessGenre(game)) return false;
  if (game.price.discountPercent < filters.minDiscount) return false;
  if (game.reviews.total < filters.minReviews) return false;
  if ((game.reviews.positivePercent ?? 0) < filters.minRating) return false;
  if (game.internal.releaseTimestamp !== null && game.internal.releaseTimestamp < filters.minReleaseTime) return false;

  if (filters.os === "win" && !game.internal.platforms.windows) return false;
  if ((filters.os === "mac" || filters.os === "applesilicon") && !game.internal.platforms.mac) return false;
  if (filters.os === "linux" && !game.internal.platforms.linux) return false;

  return true;
}

function hasEarlyAccessGenre(game: GameResult): boolean {
  return game.genres.some((genre) => genre.id === "70" || genre.description?.toLowerCase() === "early access");
}

function compareGames(a: GameResult, b: GameResult, sort: SortKey): number {
  if (sort === "discount_asc") return ascending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "discount_desc") return descending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "rating_asc") return ascending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "rating_desc") return descending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "reviews_asc") return ascending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "reviews_desc") return descending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "positive_asc") return ascending(a.reviews.positive, b.reviews.positive) || byName(a, b);
  if (sort === "positive_desc") return descending(a.reviews.positive, b.reviews.positive) || byName(a, b);
  if (sort === "release_asc") return ascending(a.internal.releaseTimestamp ?? Number.MAX_SAFE_INTEGER, b.internal.releaseTimestamp ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "release_desc") return descending(a.internal.releaseTimestamp ?? 0, b.internal.releaseTimestamp ?? 0) || byName(a, b);
  if (sort === "price_asc") return ascending(a.price.final ?? Number.MAX_SAFE_INTEGER, b.price.final ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "price_desc") return descending(a.price.final ?? -1, b.price.final ?? -1) || byName(a, b);

  return byName(a, b);
}

function ascending(a: number, b: number): number {
  return a - b;
}

function descending(a: number, b: number): number {
  return b - a;
}

function byName(a: GameResult, b: GameResult): number {
  return a.name.localeCompare(b.name);
}

function parseSteamReleaseDate(value: string | null): number | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return parsed;

  const yearOnly = value.match(/\b(\d{4})\b/);
  if (yearOnly) {
    const year = Number.parseInt(yearOnly[1], 10);
    return Date.UTC(year, 0, 1);
  }

  return null;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function approximateEuroPrice(
  price: PriceOverview | undefined,
  config: EuroApproximationConfig
): GamePriceEuroApproximation {
  const initial = approximateSteamPriceToEuro(price?.initial ?? null, config.myrToEurRate);
  const final = approximateSteamPriceToEuro(price?.final ?? null, config.myrToEurRate);

  return {
    currency: "EUR",
    sourceCurrency: price?.currency ?? null,
    sourceToEurRate: config.myrToEurRate,
    initial,
    final,
    initialFormatted: formatEuroAmount(initial),
    finalFormatted: formatEuroAmount(final),
  };
}

function approximateSteamPriceToEuro(value: number | null, myrToEurRate: number): number | null {
  if (value === null) return null;
  return roundCurrency((value / 100) * myrToEurRate);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatEuroAmount(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function serializableFilters(filters: Filters) {
  return {
    displayOnly: filters.displayOnly,
    minDiscount: filters.minDiscount,
    minRating: filters.minRating,
    minRelease: filters.minRelease,
    minReviews: filters.minReviews,
    os: filters.os,
    sort: filters.sort,
    includeTags: filters.includeTags,
    excludeTags: filters.excludeTags,
    term: filters.term,
  };
}

function serializableOptions(config: RuntimeConfig) {
  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country,
    language: config.language,
    euroApproximation: config.euroApproximation,
    outputMode: config.outputMode,
    outputFile: config.outputFile,
    progress: config.progress,
    cache: config.cache,
  };
}

function logProgress(config: RuntimeConfig, message: string): void {
  if (!config.progress) return;
  process.stderr.write(`[steam-games] ${message}\n`);
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
