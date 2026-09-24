/**
 * Official TypeScript SDK for the Pathly public `/v1` API.
 *
 * @packageDocumentation
 */

export {
  Client,
  DEFAULT_BASE_URL,
  MAX_ATTEMPTS,
  MAX_PAGES,
  MAX_RETRY_WAIT_MS,
  PAGE_SIZE,
} from "./client.js";
export type { ClientOptions, FetchFn, SleepFn } from "./client.js";

export {
  APIError,
  NotFoundError,
  fieldOf,
  isNotFound,
  parseApiError,
} from "./errors.js";

export type {
  MaintenanceWindow,
  MaintenanceWindowInput,
  Page,
  Scenario,
  ScenarioAst,
  ScenarioInput,
  ScenarioStep,
  SlaTarget,
  SlaTargetInput,
  Webhook,
  WebhookInput,
} from "./types.js";
export { omitUndefined } from "./types.js";

export { VERSION, DEFAULT_USER_AGENT } from "./version.js";
