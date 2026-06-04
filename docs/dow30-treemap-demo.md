# Dow 30 treemap demo

## Goal

Live **treemap** at `/demo/dow30treemap`:

- **Area** = share volume traded in a **rolling ~10-minute** window (collection `_expiration`)
- **Color** = price change over that window (dark green = up, dark red = down)
- Data via **`cfs/dow30quotes.js`** (Finnhub WebSocket)

## Data source

**[Finnhub](https://finnhub.io/)** WebSocket trades with `FINNHUB_API_KEY`. The Dow 30 list (`data/dow30-symbols.json`) is 30 symbols — within the free-tier concurrent subscription limit.

## Document shape (per trade tick)

```json
{
  "_ts": 1730000000000,
  "symbol": "AAPL",
  "p": 190.52,
  "v": 100,
  "t": 1730000000123
}
```

`changePct` is computed in map/reduce from first/last price in the active window (noisy on startup until the window fills).

## Collection settings

| Setting | Value |
|---------|-------|
| `_key` | `dow30` |
| `_transient` | `true` |
| `_expiration` | `600000` (10 min) |

Collection ID: `7c4e8a2b-9f1d-4e6a-b3c8-1d2e0f4a5b6c`  
Treemap view ID: `8d5f9b3c-0a2e-5f7b-c4d9-2e3f1a5b6c7d`

## Map/reduce

Per-symbol reduce: sum `volume`, track `firstPrice` / `lastPrice`, derive `changePct`. SSE sends `[[symbol, stats], ...]` to ECharts.

Optional later: `_finalize` sort, tick-time filtering, VWAP coloring.

## Ops

| Env | Purpose |
|-----|---------|
| `FINNHUB_API_KEY` | Required for live ingest (copy `.env.example` → `.env`, local only) |
| `ENABLE_DOW30_DEMO` | Set `false` on hosts without a key |
| `DOW30_COLLECTION_ID` | Override collection GUID |

Legacy aliases `ENABLE_SP500_DEMO` / `SP500_COLLECTION_ID` still honored for deploy configs.

## Files

| File | Role |
|------|------|
| `cfs/dow30quotes.js` | Finnhub → POST documents |
| `cfs/rtdbIngest.js` | HTTP POST helper |
| `data/dow30-symbols.json` | Dow 30 tickers |
| `views/dow30treemap.pug` | Chart UI |
