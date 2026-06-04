# Boston crowding heatmap demo

## Goal

Live **crowding heatmap** at `/demo/bostoncrowding` for the Greater Boston area:

- **MapLibre GL** renders grid cells from an rtdb view
- **SSE** from rtdb pushes map/reduce results to the browser
- **Ingest** `cfs/mbtavehicles.js` consumes the MBTA V3 **vehicle SSE stream** (no polling)

## Important: not exact rider counts

MBTA exposes **crowding estimates** (`occupancy_status`, sometimes per-carriage `occupancy_percentage`), not actual passenger counts. The demo aggregates a **0–1 crowding index** per ~250 m grid cell (average across vehicles reporting crowding in that cell). Sparse routes report `occupancy_status`; many vehicles send `null` and are omitted.

## Pipeline

```
MBTA SSE (/vehicles) → mbtavehicles.js → POST documents → map (per vehicle_id)
  → reduce (latest sample) → finalize (grid avgCrowding, vehicles)
  → rtdb SSE → MapLibre heatmap
```

## Document shape

```json
{
  "_ts": 1730000000000,
  "vehicle_id": "y1857",
  "lng": -71.058,
  "lat": 42.360,
  "crowding": 0.55,
  "occupancy_status": "FEW_SEATS_AVAILABLE",
  "route_id": "1",
  "trip_id": "45030930",
  "label": "1857"
}
```

## Collection settings

| Setting | Value |
|---------|-------|
| `_key` | `boston` |
| `_transient` | `true` |

Collection ID: `b1c2d3e4-f5a6-7890-abcd-ef1234567890`  
View ID: `c2d3e4f5-a6b7-8901-bcde-f12345678901`

## Map/reduce

| Stage | Behavior |
|-------|----------|
| **map** | `emit(vehicle_id, { lng, lat, crowding, _ts })` when `crowding > 0` |
| **reduce** | Latest sample per vehicle |
| **finalize** | Grid cells with `avgCrowding`, `vehicles`, `maxCrowding` |

Heatmap weight uses `avgCrowding`.

## Ops

| Env | Purpose |
|-----|---------|
| `MBTA_API_KEY` | Required for MBTA SSE ([api-v3.mbta.com](https://api-v3.mbta.com/)); passed as `api_key` query param |
| `ENABLE_BOSTON_DEMO` | Set `false` to disable ingest |
| `BOSTON_COLLECTION_ID` | Override collection GUID |

## Files

| File | Role |
|------|------|
| `cfs/mbtavehicles.js` | MBTA SSE → POST documents |
| `cfs/mbtaOccupancy.js` | Crowding score helpers |
| `views/bostoncrowding.pug` | Map + rtdb SSE client |
