/**
 * Minimal example — create a scenario and list them.
 *
 *   PATHLY_API_TOKEN=… npx tsx examples/create-scenario.ts
 */
import { Client } from "../src/index.js";

const client = new Client();

await client.ping();

const scenario = await client.createScenario({
  name: "Home page",
  url: "https://example.com/",
  intervalSec: 300,
  expectText: "Example Domain",
  severity: "major",
});

console.log("created", scenario.id);

const all = await client.listScenarios();
console.log("count", all.length);
