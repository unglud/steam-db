# Steam games filter

Fetch filtered Steam sale games as JSON. The script uses public Steam Store endpoints, enriches each search result with price, reviews, description, demo availability, and genres, then writes a timestamped JSON result file.

No Steam API key is required.

## Quick start

```sh
pnpm install
pnpm run games
```

`pnpm run games` also works as `pnpm games`.

The default run writes a new file such as `steam-games-2026-07-26T17-08-49-558Z.json`. Existing result files are never overwritten.

This project pins Node through pnpm. If your shell does not already have a compatible `node`, `pnpm install` downloads the project runtime.

## Configure it

The main defaults live in [src/config.ts](src/config.ts). Edit `SCRIPT_CONFIG` when you want the repository defaults to change.

For local-only overrides, copy [.env.example](.env.example) to `.env` and change the values there:

```sh
cp .env.example .env
```

`.env` is ignored by git, and it is optional. A fresh clone runs from the defaults in `src/config.ts`.

Common knobs:

- `STEAM_FILTER_MIN_DISCOUNT=25`
- `STEAM_FILTER_MIN_REVIEWS=500`
- `STEAM_FILTER_MIN_RELEASE=2000-01-01`
- `STEAM_FILTER_OS=mac`
- `STEAM_FILTER_SORT=demo_positive_desc`
- `STEAM_FILTER_INCLUDE_TAGS=19,21`
- `STEAM_FILTER_EXCLUDE_TAGS=1625,1664`
- `STEAM_FILTER_IGNORE_NAMES=Undertale,Hades`
- `STEAM_LIMIT=all`
- `STEAM_PAGES=all`
- `STEAM_GAMES_OUTPUT_FILE=steam-games.json`

Supported OS values are `win`, `mac`, `linux`, `applesilicon`, and `all`. `applesilicon` maps to Steam's public `mac` search filter because the public Store endpoints do not expose a reliable Apple Silicon-native flag.

Supported sort values:

- `discount_asc`
- `discount_desc`
- `rating_asc`
- `rating_desc`
- `reviews_asc`
- `reviews_desc`
- `positive_asc`
- `positive_desc`
- `demo_positive_desc`
- `release_asc`
- `release_desc`
- `price_asc`
- `price_desc`

## Output

Each JSON result contains metadata, warnings, the normalized filters, and `games`:

```json
{
  "appid": 1145350,
  "name": "Hades II",
  "steamUrl": "https://store.steampowered.com/app/1145350/",
  "description": "Battle beyond the Underworld using dark sorcery...",
  "demoAvailable": false,
  "releaseDate": "Sep 25, 2025",
  "price": {
    "discountPercent": 25,
    "finalFormatted": "RM59.00",
    "finalEuroFormatted": "€12.66"
  },
  "reviews": {
    "score": null,
    "scoreDescription": null,
    "total": 1000,
    "positive": 900,
    "negative": 100,
    "positivePercent": 90
  },
  "genres": []
}
```

Games marked with Steam genre `{ "id": "70", "description": "Early Access" }` are filtered out.

`demoAvailable` is `true` only when Steam appdetails lists a demo and the demo app's own store page exposes an install link. This filters out stale hidden demos that remain in Steam API data.

## Cache and files

Cache files are written under `.cache/steam` by default.

Default cache TTLs:

- Steam search pages: 24 hours
- App details, including price and discount: 24 hours
- Demo page availability checks: 1 week
- Review summaries: 3 days

Expired cache files are deleted at startup when `STEAM_CACHE_CLEANUP_EXPIRED=true`.

Result retention is enabled by default. The script keeps the newest 10 matching result files for the configured output name and deletes older ones after a successful run.

## Docker server

```sh
docker compose up --build
docker compose port steam-games 3000
```

The container starts a small HTTP server. It runs the Steam crawl on startup only when no previous result file exists, then runs it every 24 hours.

- `GET /` or `GET /games`: latest result JSON
- `GET /health`: scheduler status

The compose file maps container port `3000` to a random host port. Use `docker compose port steam-games 3000` to see the actual URL.

Docker stores results and cache in the `steam-games-data` volume under `/data`. Local one-shot use with `pnpm run games` is unchanged.

## Tests

```sh
pnpm test
```

The tests cover URL construction, filtering, sorting, demo validation, cache TTLs, config parsing, and server result lookup.

## Notes

Steam may throttle app detail requests when scanning many pages. The script spaces fresh requests, retries temporary failures with backoff, and reports candidates that still fail in `warnings`. If that happens, wait a bit and run `pnpm run games` again; cached successful requests are reused, so reruns mostly fill missing app details.
