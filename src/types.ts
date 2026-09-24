/**
 * Typed payloads exchanged with the Pathly `/v1` API.
 *
 * Field names match the JSON wire format (camelCase) so responses map 1:1.
 */

export interface Scenario {
  id: string;
  name: string;
  type: string;
  url?: string | null;
  enabled?: boolean | null;
  intervalSec?: number | null;
  method?: string | null;
  expectedStatus?: number | null;
  maxLatencyMs?: number | null;
  expectText?: string | null;
  runbook?: string | null;
  cron?: string | null;
  lastStatus?: string | null;
  regions?: string[];
  tags?: string[];
  folder?: string | null;
  severity?: string | null;
  mutedUntil?: string | null;
  scenarioFingerprint?: string | null;
  createdAt?: string | null;
}

/** Journey tree accepted on write. The API never returns the steps on read. */
export interface ScenarioAst {
  steps?: ScenarioStep[];
  headers?: Record<string, string>;
  clickDelayMs?: number;
  viewport?: string;
  locale?: string;
  timezone?: string;
  basicAuth?: { username: string; password: string };
}

export interface ScenarioStep {
  op: string;
  url?: string;
  selector?: string;
  value?: string;
  text?: string;
  ms?: number;
  timeoutMs?: number;
  includes?: string;
  file?: string;
  newTab?: boolean;
  href?: string;
  urlIncludes?: string;
  ignoreCase?: boolean;
  /** Boolean on `assert_text`, string on `assert_url`. */
  regex?: boolean | string;
  path?: string;
  ignoreHash?: boolean;
  ignoreQuery?: boolean;
  key?: string;
  status?: number;
  retryTimes?: number;
  currency?: string;
  min?: number;
  max?: number;
  /** Number on `assert_amount`, string on `assert_json_path`. */
  equals?: number | string;
  name?: string;
  username?: string;
  password?: string;
}

export interface ScenarioInput {
  name?: string;
  type?: string;
  url?: string;
  intervalSec?: number;
  method?: string;
  expectedStatus?: number;
  maxLatencyMs?: number;
  expectText?: string;
  regions?: string[];
  tags?: string[];
  folder?: string;
  severity?: string;
  runbook?: string;
  cron?: string;
  enabled?: boolean;
  scenario?: ScenarioAst;
}

export interface MaintenanceWindow {
  id: string;
  monitorId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
  weekday?: number | null;
  startMinute?: number | null;
  durationMin?: number | null;
}

export interface MaintenanceWindowInput {
  monitorId?: string;
  startsAt?: string;
  endsAt?: string;
  reason?: string;
  weekday?: number;
  startMinute?: number;
  durationMin?: number;
}

export interface Webhook {
  id: string;
  events?: string[];
  enabled?: boolean | null;
  hasSecret?: boolean | null;
  urlFingerprint?: string | null;
  createdAt?: string | null;
  /** Present only on create. */
  secret?: string | null;
}

export interface WebhookInput {
  url: string;
  events?: string[];
}

export interface SlaTarget {
  id: string;
  monitorId?: string | null;
  name?: string | null;
  objectivePct?: number | null;
  windowDays?: number | null;
  excludeMaintenance?: boolean | null;
  warnAtBudgetRatio?: number | null;
  enabled?: boolean | null;
}

export interface SlaTargetInput {
  objectivePct: number;
  windowDays: number;
  monitorId?: string;
  name?: string;
  excludeMaintenance?: boolean;
  warnAtBudgetRatio?: number;
  enabled?: boolean;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string | null;
}

/** Drop keys whose value is `undefined` so the API keeps existing fields. */
export function omitUndefined(
  input: object,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
