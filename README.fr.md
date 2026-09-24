# @pathly/sdk

[English](README.md) · **Français** · [Español](README.es.md)


[![Powered by Pathly](https://img.shields.io/badge/Powered%20by-Pathly-0B5FFF?style=flat-square)](https://pathlyhq.com)
[![Website](https://img.shields.io/badge/Website-pathlyhq.com-111827?style=flat-square)](https://pathlyhq.com)
[![API docs](https://img.shields.io/badge/API-developers-2563eb?style=flat-square)](https://pathlyhq.com/fr/developers)
[![Start free](https://img.shields.io/badge/Solo-start%20free-16a34a?style=flat-square)](https://pathlyhq.com/fr/login?mode=signup)

**Pour utiliser ce SDK, vous avez besoin d’une clé API. Obtenez votre clé gratuite en vous inscrivant ici : [https://pathlyhq.com/fr/login?mode=signup&utm_source=github&utm_medium=readme&utm_campaign=signup_cta](https://pathlyhq.com/fr/login?mode=signup&utm_source=github&utm_medium=readme&utm_campaign=signup_cta).**

> **Démarrage en un clic.** Créez un compte gratuit sur [Pathly](https://pathlyhq.com) ([inscription](https://pathlyhq.com/fr/login?mode=signup&utm_source=github&utm_medium=readme&utm_campaign=signup_cta)), générez une clé API dans la console, puis exportez `PATHLY_API_TOKEN`. Ce dépôt est le pont officiel vers [la surveillance Pathly](https://pathlyhq.com) — contrôles HTTP et parcours navigateur (panier, connexion, disponibilité), données hébergées dans l’UE. Référence API : [pathlyhq.com/fr/developers](https://pathlyhq.com/fr/developers).

SDK TypeScript / JavaScript officiel pour l’API publique Pathly `/v1`.

## Installation

```bash
npm install @pathly/sdk
```

Node.js 18+ requis (`fetch` natif).

## Authentification

Exporter `PATHLY_API_TOKEN`, ou passer `token` au constructeur. Le jeton n’est jamais journalisé.

```ts
import { Client } from "@pathly/sdk";

const client = new Client(); // lit PATHLY_API_TOKEN
await client.ping();
```

Optionnel : `PATHLY_API_URL` (défaut `https://api.pathlyhq.com`).

## Démarrage rapide

```ts
import { Client } from "@pathly/sdk";

const client = new Client({ token: process.env.PATHLY_API_TOKEN! });

const scenario = await client.createScenario({
  name: "Page d’accueil",
  url: "https://shop.example.com/",
  intervalSec: 300,
  expectText: "Nos produits",
});

await client.muteScenario(scenario.id, "2026-10-01T00:00:00Z");

const webhook = await client.createWebhook({
  url: "https://hooks.example.com/pathly",
  events: ["run.failed", "run.recovered"],
});
// Conserver webhook.secret une seule fois — il n’est renvoyé qu’à la création.

await client.upsertSlaTarget({
  monitorId: scenario.id,
  name: "Checkout — 99,9 %",
  objectivePct: 99.9,
  windowDays: 30,
  excludeMaintenance: true,
});
```

## Ressources

| Ressource | Méthodes |
|---|---|
| Scénario | `createScenario`, `getScenario`, `updateScenario`, `deleteScenario`, `listScenarios`, `muteScenario` |
| Webhook | `createWebhook`, `getWebhook`, `deleteWebhook`, `listWebhooks` (pas de PATCH ; secret uniquement à la création) |
| Fenêtre de maintenance | `createMaintenanceWindow`, `getMaintenanceWindow`, `deleteMaintenanceWindow`, `listMaintenanceWindows` |
| Objectif SLA | `upsertSlaTarget` (PUT), `getSlaTarget`, `deleteSlaTarget`, `listSlaTargets` |

Les créations envoient une `Idempotency-Key` (UUID auto sauf si vous en fournissez une). Les échecs transitoires (`429`, `5xx`, réseau) sont retentés jusqu’à **4** fois, en respectant `Retry-After` (plafond **90 s**).

## Erreurs

```ts
import { APIError, isNotFound } from "@pathly/sdk";

try {
  await client.getScenario("absent");
} catch (err) {
  if (isNotFound(err)) {
    // disparu de cette organisation
  } else if (err instanceof APIError) {
    console.error(err.statusCode, err.message);
  }
}
```

## Documentation et exemples

- [docs/](./docs/) — surface API et retries
- [examples/](./examples/) — extraits exécutables


## Packages associés

| Package | Role |
|---|---|
| [pathly-sdk-python](https://github.com/pathlyhq/pathly-sdk-python) | Python SDK |
| [pathly-sdk-go](https://github.com/pathlyhq/pathly-sdk-go) | Go SDK |
| [pathly-sdk-php](https://github.com/pathlyhq/pathly-sdk-php) | PHP SDK |
| [pathly-sdk-ruby](https://github.com/pathlyhq/pathly-sdk-ruby) | Ruby gem |
| [pathly-terraform-provider](https://github.com/pathlyhq/pathly-terraform-provider) | Terraform / OpenTofu |
| [pathly-github-action](https://github.com/pathlyhq/pathly-github-action) | GitHub Action |
| [Pathly product](https://pathlyhq.com) | [Pathly monitoring](https://pathlyhq.com) |
## À propos de Pathly

[Pathly](https://pathlyhq.com) surveille les parcours clients des agences et e-commerçants : rejoue le tunnel, détecte un checkout cassé avant l’appel du client, et joint la preuve (capture, étape, consigne) à la facture de maintenance. Produit : [pathlyhq.com](https://pathlyhq.com) · Développeurs : [pathlyhq.com/fr/developers](https://pathlyhq.com/fr/developers) · Tarifs : [pathlyhq.com/fr/pricing](https://pathlyhq.com/fr/pricing).

## Auteur

| | |
|---|---|
| **Entreprise** | Pathly |
| **Auteur** | Simon Raynaud / keyral |

Voir [AUTHORS](AUTHORS).

## Licence
Apache-2.0
