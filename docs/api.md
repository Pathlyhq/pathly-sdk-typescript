# API surface

Base URL: `https://api.pathlyhq.com` (override with `PATHLY_API_URL` or `Client({ baseUrl })`).

Auth: `Authorization: Bearer <PATHLY_API_TOKEN>`.

## Endpoints

### Scenarios — `/v1/scenarios`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/scenarios` | Create (`Idempotency-Key`) |
| `GET` | `/v1/scenarios/{id}` | |
| `PATCH` | `/v1/scenarios/{id}` | Partial update |
| `DELETE` | `/v1/scenarios/{id}` | |
| `GET` | `/v1/scenarios?limit=&cursor=` | Pages `{ items, nextCursor }` |
| `POST` | `/v1/scenarios/{id}/mute` | Body `{ mutedUntil }` (`null` to unmute) |

### Webhooks — `/v1/webhooks`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/webhooks` | Create; `secret` returned **once** |
| `GET` | `/v1/webhooks/{id}` | No URL, no secret |
| `DELETE` | `/v1/webhooks/{id}` | |
| `GET` | `/v1/webhooks` | List `{ items }` |

No `PATCH`: change destination by recreate.

### Maintenance windows — `/v1/maintenance-windows`

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/maintenance-windows` | Create (`Idempotency-Key`) |
| `GET` | `/v1/maintenance-windows/{id}` | |
| `DELETE` | `/v1/maintenance-windows/{id}` | |
| `GET` | `/v1/maintenance-windows` | List |

No in-place update.

### SLA targets — `/v1/sla-targets`

| Method | Path | Notes |
|---|---|---|
| `PUT` | `/v1/sla-targets` | Upsert by scenario (`Idempotency-Key`) |
| `GET` | `/v1/sla-targets/{id}` | |
| `DELETE` | `/v1/sla-targets/{id}` | |
| `GET` | `/v1/sla-targets` | List |

### Health / auth check

`Client.ping()` calls `GET /v1/usage`. HTTP **403** is success (token valid, missing `org:read`).

## Retries

- Max **4** attempts.
- Retried: transport errors, HTTP `429`, HTTP `5xx`.
- Honour `Retry-After` (seconds), capped at **90 s**; otherwise backoff `attempt × 500 ms`.
- Same `Idempotency-Key` reused across attempts on creates.
