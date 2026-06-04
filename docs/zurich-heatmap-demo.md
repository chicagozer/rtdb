# Zurich train heatmap demo

## Goal

Live **delay-weighted heatmap** at `/demo/zurichheatmap`:

- **MapLibre GL** renders aggregated grid cells from an rtdb view
- **SSE** (`/db/stream?view=…`) pushes map/reduce results to the browser
- **Ingest** `cfs/geopstrains.js` connects to the geOps tracker WebSocket and POSTs position documents

## Pipeline

```
geOps WebSocket → geopstrains.js → POST documents → map (per train_id)
  → reduce (latest position per train) → finalize (grid cells, avg delay)
  → SSE → MapLibre heatmap
```

## Document shape (per position sample)

```json
{
  "_ts": 1730000000000,
  "train_id": "sbb_140356899179680",
  "lng": 8.541,
  "lat": 47.376,
  "delay": 120,
  "line": "S5",
  "mot": "rail"
}
```

Positions are interpolated server-side from geOps `LineString` + `time_intervals` (Web Mercator → WGS84).

## Collection settings

| Setting | Value |
|---------|-------|
| `_key` | `zurich` |
| `_transient` | `true` |
| `_expiration` | `300000` (5 min; metadata) |

Collection ID: `9a3f1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b`  
Heatmap view ID: `a4b5c6d7-e8f9-4012-8b3c-4d5e6f7a8b9c`

## Map/reduce

| Stage | Behavior |
|-------|----------|
| **map** | `emit(train_id, { lng, lat, delay, _ts })` |
| **reduce** | Latest sample per train (max `_ts`) |
| **finalize** | Bucket trains into ~250 m grid cells; `avgDelay`, `maxDelay`, `count` per cell |

The heatmap uses `avgDelay` as weight (seconds).

## Ops

| Env | Purpose |
|-----|---------|
| `GEOPS_API_KEY` | Required for live ingest |
| `ENABLE_ZURICH_DEMO` | Set `false` to disable ingest |
| `ZURICH_COLLECTION_ID` | Override collection GUID |

## Files

| File | Role |
|------|------|
| `cfs/geopstrains.js` | geOps → POST documents |
| `cfs/geopsTrajectory.js` | Interpolation / coordinate helpers |
| `sampledb/collections/9a3f1c2e-….json` | Collection definition |
| `sampledb/collection/9a3f1c2e-…/views/a4b5c6d7-….json` | Map/reduce view |
| `views/zurichheatmap.pug` | Map + SSE client |
