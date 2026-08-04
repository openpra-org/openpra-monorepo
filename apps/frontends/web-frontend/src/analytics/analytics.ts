import { getToken } from "../auth/authStorage";

const SESSION_KEY = "openpra.analytics.session";
const VISITOR_KEY = "openpra.analytics.visitor";
const CAMPAIGN_KEY = "openpra.analytics.campaign";
const IDLE_THRESHOLD_MS = 120_000;
const MAX_BUFFER = 40;

interface UsageContext {
  sessionId: string;
  projectId?: string;
  workbookId?: string;
  technicalElement?: string;
  projectType?: string;
  reactorType?: string;
}

interface UsageEvent extends UsageContext {
  type: "feature_used" | "element_time";
  feature?: string;
  activeMs?: number;
  idleMs?: number;
  occurredAt: string;
}

interface CampaignAttribution {
  token: string;
  visitorId: string;
  name: string;
}

const ELEMENT_ROUTES: ReadonlyArray<[RegExp, string]> = [
  [/^\/pos-workbooks\/([^/]+)/, "POS"],
  [/^\/ie-workbooks\/([^/]+)/, "IE"],
  [/^\/es-workbooks\/([^/]+)/, "ES"],
  [/^\/sc-workbooks\/([^/]+)/, "SC"],
  [/^\/sy-workbooks\/([^/]+)/, "SY"],
  [/^\/hr-workbooks\/([^/]+)/, "HRA"],
  [/^\/da-workbooks\/([^/]+)/, "DA"],
  [/^\/esq-workbooks\/([^/]+)/, "ESQ"],
  [/^\/ms-workbooks\/([^/]+)/, "MS"],
  [/^\/rc-workbooks\/([^/]+)/, "RC"],
  [/^\/ri-workbooks\/([^/]+)/, "RI"],
  [/^\/seismic-pra-workbooks\/([^/]+)/, "S"],
];

let buffer: UsageEvent[] = [];

function stableId(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing !== null && existing.length > 0) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

function sessionId(): string {
  return stableId(sessionStorage, SESSION_KEY);
}

function visitorId(): string {
  return stableId(localStorage, VISITOR_KEY);
}

function currentUsageContext(pathname = window.location.pathname): UsageContext {
  const project = pathname.match(/^\/projects\/([^/]+)/);
  if (project !== null) return { sessionId: sessionId(), projectId: project[1] };
  for (const [pattern, technicalElement] of ELEMENT_ROUTES) {
    const match = pathname.match(pattern);
    if (match !== null && match[1] !== "example") {
      return { sessionId: sessionId(), workbookId: match[1], technicalElement };
    }
  }
  return { sessionId: sessionId() };
}

function enqueue(event: UsageEvent): void {
  buffer.push(event);
  if (buffer.length >= MAX_BUFFER) void flushAnalytics();
}

function measure(feature: string, context: Partial<UsageContext> = {}): void {
  const cleaned = feature.trim().replace(/\s+/g, " ").slice(0, 100);
  if (cleaned.length === 0 || getToken() === null) return;
  enqueue({
    ...currentUsageContext(),
    ...context,
    type: "feature_used",
    feature: cleaned,
    occurredAt: new Date().toISOString(),
  });
}

function measureElementTime(activeMs: number, idleMs: number, context: UsageContext): void {
  if (context.technicalElement === undefined || getToken() === null) return;
  enqueue({
    ...context,
    type: "element_time",
    activeMs: Math.max(0, Math.round(activeMs)),
    idleMs: Math.max(0, Math.round(idleMs)),
    occurredAt: new Date().toISOString(),
  });
}

async function flushAnalytics(keepalive = false): Promise<void> {
  const token = getToken();
  if (token === null || buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
      keepalive,
    });
    if (!response.ok && response.status !== 401) buffer = [...events, ...buffer].slice(-MAX_BUFFER * 2);
  } catch {
    buffer = [...events, ...buffer].slice(-MAX_BUFFER * 2);
  }
}

function featureName(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const interactive = target.closest<HTMLElement>("[data-analytics-feature], button, a, [role='button'], [role='tab']");
  if (interactive === null) return null;
  const explicit = interactive.dataset["analyticsFeature"];
  if (explicit !== undefined) return explicit.trim().replace(/\s+/g, " ").slice(0, 80) || null;
  const raw = interactive.getAttribute("aria-label") ?? interactive.getAttribute("title") ?? interactive.textContent;
  if (raw === null) return null;
  const label = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  if (label.length === 0) return null;
  if (interactive.getAttribute("role") === "tab") return `tab:${label.slice(0, 48)}`;
  const action = label.toLowerCase().match(/\b(create|save|add|delete|remove|edit|open|continue|load|unload|submit|review|approve|sign|upload|download|export|run|quantify|calculate|next|previous|settings|roles|share|filter|search|copy|pause|resume|apply|view|close|cancel|invite|login|sign up)\b/)?.[1];
  return action === undefined ? null : `${interactive.tagName.toLowerCase()}:${action}`;
}

function saveCampaignAttribution(attribution: CampaignAttribution): void {
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(attribution));
}

function getCampaignAttribution(): CampaignAttribution | null {
  const stored = localStorage.getItem(CAMPAIGN_KEY);
  if (stored === null) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<CampaignAttribution>;
    if (typeof parsed.token !== "string" || typeof parsed.visitorId !== "string" || typeof parsed.name !== "string") return null;
    return { token: parsed.token, visitorId: parsed.visitorId, name: parsed.name };
  } catch {
    return null;
  }
}

function clearCampaignAttribution(): void {
  localStorage.removeItem(CAMPAIGN_KEY);
}

async function registerCampaignOpen(token: string): Promise<{ name: string; destinationPath: string; token: string }> {
  const currentVisitorId = visitorId();
  const response = await fetch(`/api/campaigns/${encodeURIComponent(token)}/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ visitorId: currentVisitorId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "This invitation link is unavailable");
  }
  const campaign = await response.json() as { name: string; destinationPath: string; token: string };
  saveCampaignAttribution({ token: campaign.token, visitorId: currentVisitorId, name: campaign.name });
  return campaign;
}

export {
  IDLE_THRESHOLD_MS,
  clearCampaignAttribution,
  currentUsageContext,
  featureName,
  flushAnalytics,
  getCampaignAttribution,
  measure,
  measureElementTime,
  registerCampaignOpen,
};
