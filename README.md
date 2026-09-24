# @pathlyhq/sdk

Official TypeScript / JavaScript SDK for the [Pathly](https://pathlyhq.com) public `/v1` API.

**English** · [Français](README.fr.md) · [Español](README.es.md)


[![Powered by Pathly](https://img.shields.io/badge/Powered%20by-Pathly-0B5FFF?style=flat-square)](https://pathlyhq.com)
[![Website](https://img.shields.io/badge/Website-pathlyhq.com-111827?style=flat-square)](https://pathlyhq.com)
[![API docs](https://img.shields.io/badge/API-developers-2563eb?style=flat-square)](https://pathlyhq.com/en/developers)
[![Start free](https://img.shields.io/badge/Solo-start%20free-16a34a?style=flat-square)](https://pathlyhq.com/en/login?mode=signup)

> **Get started in one click.** Create a free account on [Pathly](https://pathlyhq.com) ([sign up](https://pathlyhq.com/en/login?mode=signup)), create an API key in the console, then export `PATHLY_API_TOKEN`. This project is the official bridge to [Pathly monitoring](https://pathlyhq.com) — real-browser and HTTP checks for checkout, login and availability, with data hosted in the EU. Full API reference: [pathlyhq.com/en/developers](https://pathlyhq.com/en/developers).

## Install

```bash
npm install @pathlyhq/sdk
```

Requires Node.js 18+ (built-in `fetch`).

## Auth

Set `PATHLY_API_TOKEN`, or pass `token` to the constructor. The token is never logged.

```ts
import { Client } from "@pathlyhq/sdk";

const client = new Client(); // uses PATHLY_API_TOKEN
// or: new Client({ token: process.env.PATHLY_API_TOKEN })
await client.ping();
```

Optional: `PATHLY_API_URL` (default `https://api.pathlyhq.com`).

## Quick start

```ts
import { Client } from "@pathlyhq/sdk";

const client = new Client({ token: process.env.PATHLY_API_TOKEN! });

const scenario = await client.createScenario({
  name: "Home page",
  url: "https://shop.example.com/",
  intervalSec: 300,
  expectText: "Our products",
});

await client.muteScenario(scenario.id, "2026-10-01T00:00:00Z");

const webhook = await client.createWebhook({
  url: "https://hooks.example.com/pathly",
  events: ["run.failed", "run.recovered"],
});
// Store webhook.secret once — it is only returned on create.

await client.upsertSlaTarget({
  monitorId: scenario.id,
  name: "Checkout — 99.9 %",
  objectivePct: 99.9,
  windowDays: 30,
  excludeMaintenance: true,
});
```

## Resources

| Resource | Methods |
|---|---|
| Scenario | `createScenario`, `getScenario`, `updateScenario`, `deleteScenario`, `listScenarios`, `muteScenario` |
| Webhook | `createWebhook`, `getWebhook`, `deleteWebhook`, `listWebhooks` (no PATCH; secret only on create) |
| Maintenance window | `createMaintenanceWindow`, `getMaintenanceWindow`, `deleteMaintenanceWindow`, `listMaintenanceWindows` |
| SLA target | `upsertSlaTarget` (PUT), `getSlaTarget`, `deleteSlaTarget`, `listSlaTargets` |

Creates send an `Idempotency-Key` (auto-generated UUID unless you pass one). Transient failures (`429`, `5xx`, network) retry up to **4** attempts, honouring `Retry-After` (capped at **90 s**).

## Errors

```ts
import { APIError, isNotFound } from "@pathlyhq/sdk";

try {
  await client.getScenario("missing");
} catch (err) {
  if (isNotFound(err)) {
    // gone from this organization
  } else if (err instanceof APIError) {
    console.error(err.statusCode, err.message);
  }
}
```

## Docs & examples

- [docs/](./docs/) — API surface and retry behaviour
- [examples/](./examples/) — runnable snippets


## Related packages

| Package | Role |
|---|---|
| [pathly-sdk-python](https://github.com/pathlyhq/pathly-sdk-python) | Python SDK |
| [pathly-sdk-go](https://github.com/pathlyhq/pathly-sdk-go) | Go SDK |
| [pathly-sdk-php](https://github.com/pathlyhq/pathly-sdk-php) | PHP SDK |
| [pathly-sdk-ruby](https://github.com/pathlyhq/pathly-sdk-ruby) | Ruby gem |
| [pathly-terraform-provider](https://github.com/pathlyhq/pathly-terraform-provider) | Terraform / OpenTofu |
| [pathly-github-action](https://github.com/pathlyhq/pathly-github-action) | GitHub Action |
| [Pathly product](https://pathlyhq.com) | [Pathly monitoring](https://pathlyhq.com) |
## About Pathly

[Pathly](https://pathlyhq.com) is synthetic monitoring for agencies and e-commerce: replay the customer journey, catch broken checkouts before your clients call, and keep evidence (screenshot, step, runbook) ready for the invoice. Product: [pathlyhq.com](https://pathlyhq.com) · Developers: [pathlyhq.com/en/developers](https://pathlyhq.com/en/developers) · Status & pricing: [pathlyhq.com/en/pricing](https://pathlyhq.com/en/pricing).

## Author

| | |
|---|---|
| **Company** | Pathly |
| **Author** | Simon Raynaud / keyral |

See [AUTHORS](AUTHORS).

## License
Apache-2.0
