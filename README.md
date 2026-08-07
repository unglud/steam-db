# Steam Deals JSON

Steam Deals JSON is a small TypeScript Steam sale tracker and discount finder. It gives you an easy way to generate a curated JSON list of discounted Steam games, with filters for minimum discount, review count, platform, release date, tags, ignored titles, and demo availability.

The script uses public Steam Store endpoints, enriches each search result with price, reviews, description, demo availability, and genres, then writes a timestamped JSON result file. It is useful for building your own Steam sale browser, game deals watchlist, recommendation pipeline, dashboard, or static dataset.

No Steam API key is required.

## Features

- Steam deals crawler for discounted games and sale results
- Configurable filters for discounts, reviews, release date, platform, tags, and ignored game names
- Enriched game JSON with price, EUR approximation, reviews, description, genres, and verified demo availability
- Disk cache, request pacing, retry/backoff, and verbose progress logs
- One-shot CLI mode plus a Docker HTTP server that serves the latest result JSON

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

Docker Compose also reads this same `.env` file when it exists, so the usual filter and crawler settings work the same in Docker. The compose file marks `.env` as optional, so Docker still runs from the checked-in defaults when no `.env` file exists.

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

`demo_positive_desc` is the default sort. It puts games with a verified playable demo first, then sorts within each demo group by the raw number of positive Steam reviews from highest to lowest. In practice, this makes the result start with discounted games you can try immediately, with broadly liked games near the top.

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

To change Docker crawler settings, copy [.env.example](.env.example) to `.env` and edit the same variables used by the CLI:

```sh
cp .env.example .env
```

For example:

```env
STEAM_FILTER_MIN_DISCOUNT=50
STEAM_FILTER_MIN_REVIEWS=1000
STEAM_FILTER_OS=linux
STEAM_FILTER_SORT=demo_positive_desc
STEAM_GAMES_INTERVAL_HOURS=12
```

Then start the server:

```sh
docker compose up --build
docker compose port steam-games 3000
```

The container starts a small HTTP server. In Docker Compose it runs the Steam crawl on every container startup, then runs it every 24 hours.

- `GET /` or `GET /games`: latest result JSON
- `GET /health`: scheduler status

The compose file maps container port `3000` to a random host port. Use `docker compose port steam-games 3000` to see the actual URL.

Docker stores results and cache in the `steam-games-data` volume under `/data`. The compose file intentionally overrides `STEAM_GAMES_OUTPUT_FILE` and `STEAM_GAMES_CACHE_DIR` to use that volume, even if `.env` has local CLI paths like `steam-games.json` or `.cache/steam`.

To change container-only settings such as the exposed container port, output path, cache path, or volume mount, edit the `environment` and `volumes` sections in [docker-compose.yml](docker-compose.yml). Local one-shot use with `pnpm run games` is unchanged.

## Tests

```sh
pnpm test
```

The tests cover URL construction, filtering, sorting, demo validation, cache TTLs, config parsing, and server result lookup.

## Notes

Steam may throttle app detail requests when scanning many pages. The script spaces fresh requests, retries temporary failures with backoff, and reports candidates that still fail in `warnings`. If that happens, wait a bit and run `pnpm run games` again; cached successful requests are reused, so reruns mostly fill missing app details.
