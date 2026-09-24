/**
 * Webhook + SLA target around an existing scenario id.
 *
 *   PATHLY_API_TOKEN=… SCENARIO_ID=mon_… npx tsx examples/webhook-and-sla.ts
 */
import { Client } from "../src/index.js";

const scenarioId = process.env.SCENARIO_ID;
if (!scenarioId) {
  throw new Error("Set SCENARIO_ID to an existing scenario id.");
}

const client = new Client();

const webhook = await client.createWebhook({
  url: "https://hooks.example.com/pathly",
  events: ["run.failed", "run.recovered"],
});
console.log("webhook", webhook.id);
// Persist webhook.secret in a vault — never commit it.

const sla = await client.upsertSlaTarget({
  monitorId: scenarioId,
  name: "Availability 99.9%",
  objectivePct: 99.9,
  windowDays: 30,
  excludeMaintenance: true,
  warnAtBudgetRatio: 0.8,
});
console.log("sla", sla.id);
