# @pathlyhq/sdk

[English](README.md) · [Français](README.fr.md) · **Español**


[![Powered by Pathly](https://img.shields.io/badge/Powered%20by-Pathly-0B5FFF?style=flat-square)](https://pathlyhq.com)
[![Website](https://img.shields.io/badge/Website-pathlyhq.com-111827?style=flat-square)](https://pathlyhq.com)
[![API docs](https://img.shields.io/badge/API-developers-2563eb?style=flat-square)](https://pathlyhq.com/es/developers)
[![Start free](https://img.shields.io/badge/Solo-start%20free-16a34a?style=flat-square)](https://pathlyhq.com/es/login?mode=signup)

> **Empiece en un clic.** Cree una cuenta gratuita en [Pathly](https://pathlyhq.com) ([registro](https://pathlyhq.com/es/login?mode=signup)), genere una clave API en la consola y exporte `PATHLY_API_TOKEN`. Este repositorio es el puente oficial hacia [la monitorización Pathly](https://pathlyhq.com): comprobaciones HTTP y de navegador (carrito, login, disponibilidad), con datos en la UE. Referencia API: [pathlyhq.com/es/developers](https://pathlyhq.com/es/developers).

> **La versión en inglés es la referencia.** Este documento traduce [`README.md`](README.md).

SDK oficial TypeScript / JavaScript para la API pública [Pathly](https://pathlyhq.com) `/v1`.

## Instalación

```bash
npm install @pathlyhq/sdk
```

Requiere Node.js 18+ (`fetch` integrado).

## Autenticación

Defina `PATHLY_API_TOKEN`, o pase `token` al constructor. El token nunca se registra en logs.

```ts
import { Client } from "@pathlyhq/sdk";

const client = new Client(); // uses PATHLY_API_TOKEN
// or: new Client({ token: process.env.PATHLY_API_TOKEN })
await client.ping();
```

Opcional: `PATHLY_API_URL` (por defecto `https://api.pathlyhq.com`).

## Inicio rápido

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

## Recursos

| Recurso | Métodos |
|---|---|
| Escenario | `createScenario`, `getScenario`, `updateScenario`, `deleteScenario`, `listScenarios`, `muteScenario` |
| Webhook | `createWebhook`, `getWebhook`, `deleteWebhook`, `listWebhooks` (sin PATCH; secret solo en create) |
| Ventana de mantenimiento | `createMaintenanceWindow`, `getMaintenanceWindow`, `deleteMaintenanceWindow`, `listMaintenanceWindows` |
| Objetivo SLA | `upsertSlaTarget` (PUT), `getSlaTarget`, `deleteSlaTarget`, `listSlaTargets` |

Las creaciones envían un `Idempotency-Key` (UUID generado automáticamente salvo que pase uno). Los fallos transitorios (`429`, `5xx`, red) se reintentan hasta **4** veces, respetando `Retry-After` (tope de **90 s**).

## Errores

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

## Documentación y ejemplos

- [docs/](./docs/) — superficie de la API y comportamiento de reintentos
- [examples/](./examples/) — fragmentos ejecutables


## Paquetes relacionados

| Package | Role |
|---|---|
| [pathly-sdk-python](https://github.com/pathlyhq/pathly-sdk-python) | Python SDK |
| [pathly-sdk-go](https://github.com/pathlyhq/pathly-sdk-go) | Go SDK |
| [pathly-sdk-php](https://github.com/pathlyhq/pathly-sdk-php) | PHP SDK |
| [pathly-sdk-ruby](https://github.com/pathlyhq/pathly-sdk-ruby) | Ruby gem |
| [pathly-terraform-provider](https://github.com/pathlyhq/pathly-terraform-provider) | Terraform / OpenTofu |
| [pathly-github-action](https://github.com/pathlyhq/pathly-github-action) | GitHub Action |
| [Pathly product](https://pathlyhq.com) | [Pathly monitoring](https://pathlyhq.com) |
## Acerca de Pathly

[Pathly](https://pathlyhq.com) es monitorización sintética para agencias y e-commerce: reproduce el recorrido del cliente, detecta un checkout roto antes de la llamada, y deja la prueba (captura, paso, runbook) lista para la factura. Producto: [pathlyhq.com](https://pathlyhq.com) · Desarrolladores: [pathlyhq.com/es/developers](https://pathlyhq.com/es/developers) · Precios: [pathlyhq.com/es/pricing](https://pathlyhq.com/es/pricing).

## Autor

| | |
|---|---|
| **Empresa** | Pathly |
| **Autor** | Simon Raynaud / keyral |

Véase [AUTHORS](AUTHORS).

## Licencia
Apache-2.0
