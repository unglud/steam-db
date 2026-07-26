# Steam games filter

Fetch Steam games as JSON using public Steam endpoints and filters shaped like the SteamDB sale URL parameters.

```sh
pnpm install
pnpm run games
```

This project pins Node through pnpm, so `pnpm install` downloads the project runtime if your shell does not have `node`.

`pnpm run games` returns all matches for the default query in one CLI run. Steam still serves the data through paginated and per-app HTTP calls, so a large result set can take a while.

For a quick capped smoke test:

```sh
pnpm run games:sample
```

Or pass a full URL/query string and optional caps:

```sh
pnpm run games -- "displayOnly=Game&min_discount=25&min_reviews=500&os=mac" --limit=50 --pages=2 --sort=discount_desc
```

The script prints a JSON object with `filters`, `warnings`, and `games`.

## Supported filters

- `displayOnly=Game`
- `min_discount=25`
- `min_rating=0`
- `min_release=2000-01-01`
- `min_reviews=500`
- `os=win|mac|linux|applesilicon`
- `sort=discount_asc|discount_desc|rating_asc|rating_desc|reviews_asc|reviews_desc|release_asc|release_desc|price_asc|price_desc`
- `tagid=19,-3799` for included and excluded Steam tag ids

`os=applesilicon` is mapped to Steam's public `mac` search filter. The public Steam store APIs expose Mac support, but not a reliable Apple Silicon-native flag, so each result includes an `appleSilicon` hint derived from macOS requirement text when Steam provides it.

## Options

- `--all` scan all pages, enrich all candidates, and return all matches
- `--limit=50` maximum returned games; defaults to all
- `--pages=2` Steam search pages to scan, 50 candidates per page; defaults to all
- `--max-candidates=25` maximum candidates to enrich after search/app-list discovery; defaults to all
- `--start=0` first Steam search offset
- `--concurrency=2` concurrent detail/review lookups
- `--cc=US` country code for price data
- `--lang=english` language for store details
- `--source=search|applist`

`source=search` is the default because Steam search supports OS, specials, and tag filters. `source=applist` uses `IStoreService/GetAppList` and requires `STEAM_WEB_API_KEY`, but it cannot prefilter by tags or discounts.

Use `--limit=all`, `--pages=all`, or `--max-candidates=all` to clear a cap explicitly. Steam may throttle app detail requests when scanning many pages; throttled candidates are reported in `warnings`.
