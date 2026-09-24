# Changelog

## 0.1.0 — 2026-09-23

- Premier publish : client HTTP (`fetch`), scénarios, webhooks, fenêtres de maintenance, objectifs SLA.
- `Idempotency-Key` sur les créations, retries (`Retry-After`, max 4, plafond 90 s).
- `ping()` via `GET /v1/usage` (403 accepté).
- Dual ESM + CJS, TypeScript strict.
