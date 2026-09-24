# Retries and idempotency

Creates (`POST` / SLA `PUT`) always send `Idempotency-Key`. If you omit the argument, the SDK generates a UUID (or a `sdk-…` fallback when `crypto.randomUUID` is unavailable).

On a lost response after the server accepted the write, the next attempt with the same key does not create a duplicate.

`Retry-After` on `429` / `5xx` is preferred over the internal backoff. Values above 90 seconds are clamped so a stuck pipeline does not wait forever.
