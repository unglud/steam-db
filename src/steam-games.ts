declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
  stderr: { write(chunk: string): void };
};

type Source = "search" | "applist";
type SortKey =
  | "discount_asc"
  | "discount_desc"
  | "rating_asc"
  | "rating_desc"
  | "reviews_asc"
  | "reviews_desc"
  | "release_asc"
  | "release_desc"
  | "price_asc"
  | "price_desc";

type PlatformName = "win" | "mac" | "linux" | "applesilicon" | "";

type CliConfig = {
  query: string;
  limit: number | null;
  pages: number | null;
  maxCandidates: number | null;
  start: number;
  concurrency: number;
  country: string;
  language: string;
  source: Source;
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

type AppListResponse = {
  response?: {
    apps?: Array<{
      appid: number;
      name?: string;
      last_modified?: number;
      price_change_number?: number;
    }>;
    have_more_results?: boolean;
    last_appid?: number;
  };
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
  type?: string;
  name?: string;
  steam_appid?: number;
  is_free?: boolean;
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
  metacritic?: {
    score?: number;
    url?: string;
  };
  recommendations?: {
    total?: number;
  };
  genres?: Array<{ id?: string; description?: string }>;
  categories?: Array<{ id?: number; description?: string }>;
  mac_requirements?: {
    minimum?: string;
    recommended?: string;
  };
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

type GameResult = {
  appid: number;
  name: string;
  type: string;
  steamUrl: string;
  releaseDate: string | null;
  releaseTimestamp: number | null;
  platforms: {
    windows: boolean;
    mac: boolean;
    linux: boolean;
  };
  appleSilicon: {
    requested: boolean;
    publicSteamFilter: "mac" | null;
    requirementHint: "mentioned" | "not_mentioned" | "unknown";
  };
  price: {
    currency: string | null;
    initial: number | null;
    final: number | null;
    discountPercent: number;
    initialFormatted: string | null;
    finalFormatted: string | null;
  };
  reviews: {
    score: number | null;
    scoreDescription: string | null;
    total: number;
    positive: number;
    negative: number;
    positivePercent: number | null;
  };
  metacritic: {
    score: number | null;
    url: string | null;
  };
  recommendations: number | null;
  genres: Array<{ id: string | null; description: string | null }>;
  categories: Array<{ id: number | null; description: string | null }>;
};

const DEFAULT_QUERY =
  "displayOnly=Game&min_discount=25&min_rating=0&min_release=2000-01-01&min_reviews=500&os=applesilicon&sort=discount_asc&tagid=-1625%2C-1664%2C-3799%2C-3843%2C-3859%2C-5537%2C-7178";
const USER_AGENT = "steam-db-ts-script/0.1 (+https://store.steampowered.com)";
const SEARCH_PAGE_SIZE = 50;
const DETAIL_FILTERS = [
  "price_overview",
  "release_date",
  "platforms",
  "recommendations",
  "metacritic",
  "type",
  "name",
  "steam_appid",
  "is_free",
  "categories",
  "genres",
  "mac_requirements",
].join(",");

async function main(): Promise<void> {
  const config = parseCli(process.argv.slice(2));
  const filters = parseFilters(config.query);
  const warnings: string[] = [];

  if (filters.os === "applesilicon") {
    warnings.push(
      "Steam's public store APIs expose macOS filtering, but not a reliable Apple Silicon-native flag; this query uses os=mac and returns a best-effort macOS requirement hint."
    );
  }

  const discoveredCandidates =
    config.source === "applist"
      ? await fetchAppListCandidates(config, warnings)
      : await fetchSearchCandidates(filters, config);
  const candidates =
    config.maxCandidates === null ? discoveredCandidates : discoveredCandidates.slice(0, config.maxCandidates);

  const skippedCandidates: string[] = [];
  const games = await mapConcurrent(candidates, config.concurrency, async (candidate) => {
    try {
      return await enrichCandidate(candidate, config, filters);
    } catch (error) {
      skippedCandidates.push(`${candidate.appid}: ${errorMessage(error).split("\n")[0]}`);
      return null;
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

  const output = {
    generatedAt: new Date().toISOString(),
    source: config.source,
    discoveredCandidates: discoveredCandidates.length,
    scannedCandidates: candidates.length,
    returned: returnedGames.length,
    options: serializableOptions(config),
    filters: serializableFilters(filters),
    warnings,
    games: returnedGames,
  };

  console.log(JSON.stringify(output, null, 2));
}

function parseCli(args: string[]): CliConfig {
  let query = DEFAULT_QUERY;
  const overrides = new URLSearchParams();
  const config: CliConfig = {
    query,
    limit: null,
    pages: null,
    maxCandidates: null,
    start: 0,
    concurrency: 2,
    country: process.env.STEAM_CC ?? "US",
    language: process.env.STEAM_LANG ?? "english",
    source: "search",
  };

  for (const arg of args) {
    if (arg === "--") continue;
    if (arg === "--all") {
      config.limit = null;
      config.pages = null;
      config.maxCandidates = null;
      continue;
    }

    if (!arg.startsWith("--")) {
      query = arg;
      continue;
    }

    const [rawKey, rawValue = "true"] = arg.slice(2).split("=", 2);
    const key = normalizeCliKey(rawKey);
    const value = rawValue.trim();

    if (key === "limit") config.limit = readOptionalInteger(value, "limit");
    else if (key === "pages") config.pages = readOptionalInteger(value, "pages");
    else if (key === "max_candidates") config.maxCandidates = readOptionalInteger(value, "max-candidates");
    else if (key === "start") config.start = readInteger(value, "start", 0, 100000);
    else if (key === "concurrency") config.concurrency = readInteger(value, "concurrency", 1, 10);
    else if (key === "cc" || key === "country") config.country = value.toUpperCase();
    else if (key === "lang" || key === "language") config.language = value;
    else if (key === "source") config.source = parseSource(value);
    else overrides.set(cliKeyToQueryParam(key), value);
  }

  const params = new URLSearchParams(queryToSearchParams(query));
  for (const [key, value] of overrides) params.set(key, value);

  config.query = params.toString();
  return config;
}

function normalizeCliKey(key: string): string {
  return key.trim().replaceAll("-", "_");
}

function cliKeyToQueryParam(key: string): string {
  const map: Record<string, string> = {
    display_only: "displayOnly",
    min_discount: "min_discount",
    min_rating: "min_rating",
    min_release: "min_release",
    min_reviews: "min_reviews",
    tagid: "tagid",
    tags: "tagid",
    os: "os",
    sort: "sort",
    term: "term",
  };

  return map[key] ?? key;
}

function parseSource(value: string): Source {
  if (value === "search" || value === "applist") return value;
  throw new Error(`Unsupported source "${value}". Use search or applist.`);
}

function readInteger(value: string, label: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${label} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function readOptionalInteger(value: string, label: string): number | null {
  if (isUnlimitedValue(value)) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`--${label} must be a positive integer, "all", "none", or 0.`);
  }

  return parsed;
}

function isUnlimitedValue(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized === "all" || normalized === "none" || normalized === "unlimited" || normalized === "0";
}

function parseFilters(query: string): Filters {
  const params = queryToSearchParams(query);
  const tagIds = parseTagIds(params.get("tagid") ?? params.get("tags") ?? "");
  const minRelease = params.get("min_release") ?? "1970-01-01";
  const minReleaseTime = Date.parse(`${minRelease}T00:00:00Z`);

  if (!Number.isFinite(minReleaseTime)) {
    throw new Error(`min_release must be an ISO date like 2000-01-01. Got "${minRelease}".`);
  }

  return {
    displayOnly: params.get("displayOnly") ?? "Game",
    minDiscount: numberParam(params, "min_discount", 0),
    minRating: numberParam(params, "min_rating", 0),
    minRelease,
    minReleaseTime,
    minReviews: numberParam(params, "min_reviews", 0),
    os: parsePlatform(params.get("os") ?? ""),
    sort: parseSort(params.get("sort") ?? "discount_asc"),
    includeTags: tagIds.filter((tag) => tag > 0),
    excludeTags: tagIds.filter((tag) => tag < 0).map((tag) => Math.abs(tag)),
    term: params.get("term") ?? "",
  };
}

function queryToSearchParams(value: string): URLSearchParams {
  const trimmed = value.trim();
  if (!trimmed) return new URLSearchParams();

  try {
    const url = new URL(trimmed);
    return url.searchParams;
  } catch {
    return new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
  }
}

function numberParam(params: URLSearchParams, key: string, fallback: number): number {
  const value = params.get(key);
  if (value === null || value === "") return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} must be a number. Got "${value}".`);
  }

  return parsed;
}

function parseTagIds(value: string): number[] {
  return value
    .split(",")
    .map((tag) => Number.parseInt(tag.trim(), 10))
    .filter((tag) => Number.isFinite(tag));
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
    "release_asc",
    "release_desc",
    "price_asc",
    "price_desc",
  ];

  if (supported.includes(value as SortKey)) return value as SortKey;
  throw new Error(`Unsupported sort "${value}". Supported sorts: ${supported.join(", ")}.`);
}

async function fetchSearchCandidates(filters: Filters, config: CliConfig): Promise<Candidate[]> {
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

    const response = await fetchJson<SearchResponse>(url);
    const items = response.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      const appid = extractAppId(item.logo ?? "");
      if (appid === null) continue;
      candidates.set(appid, { appid, name: item.name });
    }

    if (items.length < SEARCH_PAGE_SIZE || candidates.size === previousCandidateCount) break;
  }

  return [...candidates.values()];
}

async function fetchAppListCandidates(config: CliConfig, warnings: string[]): Promise<Candidate[]> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) {
    throw new Error("source=applist requires STEAM_WEB_API_KEY in the environment.");
  }

  warnings.push(
    "source=applist scans Valve's app catalog but cannot prefilter by search-only fields such as tags, OS, or active discounts."
  );

  const candidates: Candidate[] = [];
  let lastAppId = config.start;

  for (let page = 0; config.pages === null || page < config.pages; page += 1) {
    const input = {
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: SEARCH_PAGE_SIZE,
      last_appid: lastAppId,
    };
    const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
    url.searchParams.set("key", key);
    url.searchParams.set("input_json", JSON.stringify(input));

    const response = await fetchJson<AppListResponse>(url);
    const apps = response.response?.apps ?? [];
    if (apps.length === 0) break;

    for (const app of apps) {
      candidates.push({ appid: app.appid, name: app.name });
    }

    lastAppId = response.response?.last_appid ?? apps[apps.length - 1]?.appid ?? lastAppId;
    if (!response.response?.have_more_results) break;
  }

  return candidates;
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

async function enrichCandidate(candidate: Candidate, config: CliConfig, filters: Filters): Promise<GameResult | null> {
  const [details, reviews] = await Promise.all([
    fetchAppDetails(candidate.appid, config),
    fetchReviewSummary(candidate.appid),
  ]);

  if (!details) return null;

  const price = details.price_overview;
  const reviewTotal = reviews.total_reviews ?? 0;
  const positive = reviews.total_positive ?? 0;
  const negative = reviews.total_negative ?? 0;
  const releaseTime = parseSteamReleaseDate(details.release_date?.date ?? null);
  const inferredType = details.type ?? (filters.displayOnly.toLowerCase() === "game" ? "game" : "unknown");
  const platforms = {
    windows: details.platforms?.windows ?? false,
    mac: details.platforms?.mac ?? false,
    linux: details.platforms?.linux ?? false,
  };

  return {
    appid: details.steam_appid ?? candidate.appid,
    name: details.name ?? candidate.name ?? String(candidate.appid),
    type: inferredType,
    steamUrl: `https://store.steampowered.com/app/${candidate.appid}/`,
    releaseDate: details.release_date?.date ?? null,
    releaseTimestamp: releaseTime,
    platforms,
    appleSilicon: {
      requested: filters.os === "applesilicon",
      publicSteamFilter: filters.os === "applesilicon" ? "mac" : null,
      requirementHint: detectAppleSiliconHint(details),
    },
    price: {
      currency: price?.currency ?? null,
      initial: price?.initial ?? null,
      final: price?.final ?? null,
      discountPercent: price?.discount_percent ?? 0,
      initialFormatted: price?.initial_formatted ?? null,
      finalFormatted: price?.final_formatted ?? null,
    },
    reviews: {
      score: reviews.review_score ?? null,
      scoreDescription: reviews.review_score_desc ?? null,
      total: reviewTotal,
      positive,
      negative,
      positivePercent: reviewTotal > 0 ? roundPercent((positive / reviewTotal) * 100) : null,
    },
    metacritic: {
      score: details.metacritic?.score ?? null,
      url: details.metacritic?.url ?? null,
    },
    recommendations: details.recommendations?.total ?? null,
    genres: (details.genres ?? []).map((genre) => ({
      id: genre.id ?? null,
      description: genre.description ?? null,
    })),
    categories: (details.categories ?? []).map((category) => ({
      id: category.id ?? null,
      description: category.description ?? null,
    })),
  };
}

async function fetchAppDetails(appid: number, config: CliConfig): Promise<StoreDetails | null> {
  const url = new URL("https://store.steampowered.com/api/appdetails");
  url.searchParams.set("appids", String(appid));
  url.searchParams.set("filters", DETAIL_FILTERS);
  url.searchParams.set("cc", config.country);
  url.searchParams.set("l", config.language);

  const response = await fetchJson<AppDetailsResponse>(url);
  const app = response[String(appid)];
  if (!app?.success || !app.data) return null;

  return app.data;
}

async function fetchReviewSummary(appid: number): Promise<ReviewSummary> {
  const url = new URL(`https://store.steampowered.com/appreviews/${appid}`);
  url.searchParams.set("json", "1");
  url.searchParams.set("language", "all");
  url.searchParams.set("purchase_type", "all");
  url.searchParams.set("num_per_page", "0");

  const response = await fetchJson<ReviewResponse>(url);
  return response.query_summary ?? {};
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
  if (filters.displayOnly.toLowerCase() === "game" && game.type !== "game") return false;
  if (game.price.discountPercent < filters.minDiscount) return false;
  if (game.reviews.total < filters.minReviews) return false;
  if ((game.reviews.positivePercent ?? 0) < filters.minRating) return false;
  if (game.releaseTimestamp !== null && game.releaseTimestamp < filters.minReleaseTime) return false;

  if (filters.os === "win" && !game.platforms.windows) return false;
  if ((filters.os === "mac" || filters.os === "applesilicon") && !game.platforms.mac) return false;
  if (filters.os === "linux" && !game.platforms.linux) return false;

  return true;
}

function compareGames(a: GameResult, b: GameResult, sort: SortKey): number {
  if (sort === "discount_asc") return ascending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "discount_desc") return descending(a.price.discountPercent, b.price.discountPercent) || byName(a, b);
  if (sort === "rating_asc") return ascending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "rating_desc") return descending(a.reviews.positivePercent ?? -1, b.reviews.positivePercent ?? -1) || byName(a, b);
  if (sort === "reviews_asc") return ascending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "reviews_desc") return descending(a.reviews.total, b.reviews.total) || byName(a, b);
  if (sort === "release_asc") return ascending(a.releaseTimestamp ?? Number.MAX_SAFE_INTEGER, b.releaseTimestamp ?? Number.MAX_SAFE_INTEGER) || byName(a, b);
  if (sort === "release_desc") return descending(a.releaseTimestamp ?? 0, b.releaseTimestamp ?? 0) || byName(a, b);
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

function detectAppleSiliconHint(details: StoreDetails): "mentioned" | "not_mentioned" | "unknown" {
  const requirements = [details.mac_requirements?.minimum, details.mac_requirements?.recommended]
    .filter((value): value is string => Boolean(value))
    .map(stripHtml)
    .join(" ")
    .toLowerCase();

  if (!requirements) return "unknown";
  if (/\b(apple silicon|arm64|aarch64|m[1-9](\s|-)?(pro|max|ultra)?)\b/.test(requirements)) {
    return "mentioned";
  }

  return "not_mentioned";
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
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

function serializableOptions(config: CliConfig) {
  return {
    limit: config.limit,
    pages: config.pages,
    maxCandidates: config.maxCandidates,
    start: config.start,
    concurrency: config.concurrency,
    country: config.country,
    language: config.language,
  };
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
