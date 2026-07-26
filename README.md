# Steam games filter

Fetch Steam games as JSON using public Steam endpoints and filters shaped like the SteamDB sale URL parameters.

```sh
pnpm run games:sample
```

Or pass a full URL/query string and overrides:

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

- `--limit=25` maximum returned games
- `--pages=1` Steam search pages to scan, 50 candidates per page
- `--max-candidates=25` maximum candidates to enrich after search/app-list discovery
- `--start=0` first Steam search offset
- `--concurrency=2` concurrent detail/review lookups
- `--cc=US` country code for price data
- `--lang=english` language for store details
- `--source=search|applist`

`source=search` is the default because Steam search supports OS, specials, and tag filters. `source=applist` uses `IStoreService/GetAppList` and requires `STEAM_WEB_API_KEY`, but it cannot prefilter by tags or discounts.

Steam may throttle app detail requests when scanning many pages. Increase `--pages` slowly if you need a deeper result set.
