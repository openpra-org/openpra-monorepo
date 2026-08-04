import { useEffect, useMemo, useState } from "react";
import { TopBar } from "../welcome/topBar";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../toast/toastProvider";
import {
  createCampaign,
  downloadCsv,
  getAdminUsers,
  getCampaigns,
  getMetrics,
  setCampaignActive,
  setUserAdmin,
  type AdminMetrics,
  type AdminUser,
  type Campaign,
  type DashboardFilters,
  type MetricPoint,
} from "./adminApi";
import "./adminPage.css";

type Tab = "overview" | "campaigns" | "access";

function dateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function initialFilters(): DashboardFilters {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return { start: dateInput(start), end: dateInput(end), reactorType: "" };
}
function formatNumber(value: number): string { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(minutes >= 600 ? 0 : 1)}h`;
}
function formatDate(value: string | null): string {
  if (value === null) return "Never";
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly === null ? new Date(value) : new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatProjectType(value: string): string {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Icon({ name }: { name: "users" | "pulse" | "folder" | "layers" | "download" | "refresh" | "link" | "shield" }): JSX.Element {
  const paths: Record<string, JSX.Element> = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></>,
    pulse: <path d="M3 12h4l2.4-6 4.2 12 2.2-6H21"/>,
    folder: <><path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function SummaryCard({ label, value, note, icon, tone }: { label: string; value: string; note: string; icon: "users" | "pulse" | "folder" | "layers"; tone: string }): JSX.Element {
  return (
    <article className={`adm-summary adm-summary--${tone}`}>
      <div className="adm-summary__icon"><Icon name={icon} /></div>
      <div><p>{label}</p><strong>{value}</strong><span>{note}</span></div>
    </article>
  );
}

function EmptyChart({ children }: { children: string }): JSX.Element {
  return <div className="adm-empty-chart"><span>◇</span><p>{children}</p></div>;
}

function BarList({ rows, color = "emerald" }: { rows: MetricPoint[]; color?: "emerald" | "violet" | "amber" }): JSX.Element {
  if (rows.length === 0) return <EmptyChart>No activity in this range yet.</EmptyChart>;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <div className="adm-bars">
      {rows.slice(0, 8).map((row, index) => (
        <div className="adm-bars__row" key={row.label}>
          <span className="adm-bars__rank">{String(index + 1).padStart(2, "0")}</span>
          <div className="adm-bars__main">
            <div className="adm-bars__meta"><span title={row.label}>{row.label}</span><strong>{formatNumber(row.count)}</strong></div>
            <div className="adm-bars__track"><i className={`adm-bars__fill adm-bars__fill--${color}`} style={{ width: `${Math.max(3, row.count / max * 100)}%` }} /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ rows }: { rows: MetricPoint[] }): JSX.Element {
  if (rows.length === 0) return <EmptyChart>New account activity will appear here.</EmptyChart>;
  const width = 620;
  const height = 190;
  const pad = 22;
  const max = Math.max(...rows.map((row) => row.count), 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : pad + index / (rows.length - 1) * (width - pad * 2);
    const y = height - pad - row.count / max * (height - pad * 2);
    return { x, y, row };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return (
    <div className="adm-trend">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Accounts created over time">
        <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#31a47d" stopOpacity=".3"/><stop offset="1" stopColor="#31a47d" stopOpacity="0"/></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1={pad} x2={width - pad} y1={height * ratio} y2={height * ratio} className="adm-trend__grid" />)}
        <polygon points={area} fill="url(#trend-fill)" />
        <polyline points={line} className="adm-trend__line" />
        {points.map((point) => <circle key={point.row.label} cx={point.x} cy={point.y} r="4" className="adm-trend__dot"><title>{point.row.label}: {point.row.count}</title></circle>)}
      </svg>
      <div className="adm-trend__axis"><span>{formatDate(rows[0].label)}</span><span>{formatDate(rows[rows.length - 1].label)}</span></div>
    </div>
  );
}

function ActiveIdle({ activeMs, idleMs, threshold }: { activeMs: number; idleMs: number; threshold: number }): JSX.Element {
  const total = activeMs + idleMs;
  const activePct = total === 0 ? 0 : Math.round(activeMs / total * 100);
  return (
    <div className="adm-split">
      <div className="adm-split__donut" style={{ background: `conic-gradient(#2a9d78 0 ${activePct}%, #e5ad5b ${activePct}% 100%)` }}>
        <div><strong>{activePct}%</strong><span>active</span></div>
      </div>
      <div className="adm-split__legend">
        <div><i className="adm-dot adm-dot--active"/><span>Active work</span><strong>{formatDuration(activeMs)}</strong></div>
        <div><i className="adm-dot adm-dot--idle"/><span>Idle / thinking</span><strong>{formatDuration(idleMs)}</strong></div>
        <p>Idle begins after {Math.round(threshold / 60)} minutes without interaction.</p>
      </div>
    </div>
  );
}

function SessionRanking({ rows }: { rows: AdminMetrics["sessionRanking"] }): JSX.Element {
  if (rows.length === 0) return <EmptyChart>Per-session rankings will appear as practitioners spend time in technical elements.</EmptyChart>;
  return (
    <div className="adm-session-list">
      {rows.slice(0, 10).map((row, index) => (
        <div className="adm-session-list__row" key={`${row.sessionId}:${row.technicalElement}`}>
          <span className="adm-session-list__rank">{index + 1}</span>
          <span className="adm-session-list__element">{row.technicalElement}</span>
          <div><strong>@{row.username}</strong><small>Session {row.sessionId.slice(0, 8)}</small></div>
          <div className="adm-session-list__split"><i style={{ width: `${row.totalMs === 0 ? 0 : row.activeMs / row.totalMs * 100}%` }} /></div>
          <span>{formatDuration(row.activeMs)} active</span>
          <strong>{formatDuration(row.totalMs)}</strong>
        </div>
      ))}
    </div>
  );
}

function CampaignsPanel({ campaigns, onCreated, onToggle }: { campaigns: Campaign[]; onCreated: (campaign: Campaign) => void; onToggle: (campaign: Campaign) => void }): JSX.Element {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { addToast } = useToast();

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    if (name.trim().length === 0) return;
    setBusy(true);
    createCampaign({ name: name.trim(), destinationPath: "/auth?signup=1", expiresAt: expiresAt || null })
      .then((campaign) => { onCreated(campaign); setName(""); setExpiresAt(""); addToast({ id: crypto.randomUUID(), type: "success", message: "Attribution link created" }); })
      .catch((error: unknown) => { addToast({ id: crypto.randomUUID(), type: "danger", message: (error as { message?: string }).message ?? "Could not create link" }); })
      .finally(() => { setBusy(false); });
  }

  function copy(campaign: Campaign): void {
    const url = `${window.location.origin}/r/${campaign.token}`;
    void navigator.clipboard.writeText(url).then(() => { setCopied(campaign.id); window.setTimeout(() => { setCopied(null); }, 1600); });
  }

  return (
    <div className="adm-campaign-layout">
      <aside className="adm-campaign-create">
        <div className="adm-section-eyebrow"><Icon name="link" /> New tracked link</div>
        <h2>Know who came through</h2>
        <p>Create one named link per investor, event, or outreach group. Opens remain pseudonymous until that visitor creates an account.</p>
        <form onSubmit={submit}>
          <label>Link name<input value={name} onChange={(event) => { setName(event.target.value); }} placeholder="e.g. Acme Ventures · Maya Chen" maxLength={120} /></label>
          <label>Expiration <span>optional</span><input type="date" value={expiresAt} min={dateInput(new Date(Date.now() + 86_400_000))} onChange={(event) => { setExpiresAt(event.target.value); }} /></label>
          <button type="submit" disabled={busy || name.trim().length === 0}>{busy ? "Creating…" : "Create attribution link"}</button>
        </form>
        <div className="adm-privacy-note"><Icon name="shield" /><span>No keystrokes or form contents are captured. Identity is attached only after account creation.</span></div>
      </aside>
      <section className="adm-campaign-list">
        <div className="adm-panel-head"><div><p className="adm-kicker">Attribution</p><h2>Campaign links</h2></div><span className="adm-count">{campaigns.length} total</span></div>
        {campaigns.length === 0 ? <EmptyChart>Create the first link for an investor or special occasion.</EmptyChart> : campaigns.map((campaign) => (
          <article className={`adm-campaign${campaign.active ? "" : " adm-campaign--inactive"}`} key={campaign.id}>
            <div className="adm-campaign__top">
              <div><span className={`adm-status${campaign.active ? "" : " adm-status--off"}`}>{campaign.active ? "Live" : "Paused"}</span><h3>{campaign.name}</h3><p>Created by @{campaign.createdBy} · {formatDate(campaign.createdAt)}</p></div>
              <button className="adm-ghost-btn" type="button" onClick={() => { onToggle(campaign); }}>{campaign.active ? "Pause" : "Resume"}</button>
            </div>
            <div className="adm-link-box"><code>{window.location.origin}/r/{campaign.token}</code><button type="button" onClick={() => { copy(campaign); }}>{copied === campaign.id ? "Copied" : "Copy"}</button></div>
            <div className="adm-campaign__stats"><div><strong>{campaign.openCount}</strong><span>Total opens</span></div><div><strong>{campaign.uniqueOpenCount}</strong><span>Unique visitors</span></div><div><strong>{campaign.signupCount}</strong><span>Accounts created</span></div><div><strong>{campaign.expiresAt === null ? "None" : formatDate(campaign.expiresAt)}</strong><span>Expiration</span></div></div>
            {campaign.attributedUsers.length > 0 && <div className="adm-attributed"><p>Accounts attributed to this link</p>{campaign.attributedUsers.map((user) => <div key={user.username}><span>{user.fullName.slice(0, 1).toUpperCase()}</span><strong>{user.fullName}</strong><small>@{user.username} · {user.email}</small></div>)}</div>}
          </article>
        ))}
      </section>
    </div>
  );
}

function AccessPanel({ users, currentUsername, onChange }: { users: AdminUser[]; currentUsername: string; onChange: (user: AdminUser) => void }): JSX.Element {
  const [search, setSearch] = useState("");
  const filtered = users.filter((user) => `${user.fullName} ${user.username} ${user.email}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className="adm-panel adm-access">
      <div className="adm-panel-head"><div><p className="adm-kicker">Authorization</p><h2>Administrator access</h2></div><label className="adm-search"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Find an account" /></label></div>
      <div className="adm-access__list">
        {filtered.map((user) => (
          <div className="adm-access__row" key={user.id}>
            <div className="adm-person"><span>{user.fullName.slice(0, 1).toUpperCase()}</span><div><strong>{user.fullName}</strong><small>@{user.username} · {user.email}</small></div></div>
            <span className={user.isAdmin ? "adm-role adm-role--admin" : "adm-role"}>{user.isAdmin ? "Administrator" : "Member"}</span>
            <span className="adm-muted">Joined {formatDate(user.createdAt)}</span>
            <button type="button" disabled={user.username === currentUsername} className={user.isAdmin ? "adm-danger-btn" : "adm-primary-btn"} onClick={() => { onChange(user); }}>{user.isAdmin ? "Remove admin" : "Make admin"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>("overview");
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addToast } = useToast();

  const load = (): void => {
    setLoading(true);
    Promise.all([getMetrics(filters), getCampaigns(), getAdminUsers()])
      .then(([nextMetrics, nextCampaigns, nextUsers]) => { setMetrics(nextMetrics); setCampaigns(nextCampaigns); setAdminUsers(nextUsers); })
      .catch((error: unknown) => { addToast({ id: crypto.randomUUID(), type: "danger", message: (error as { message?: string }).message ?? "Could not load admin metrics" }); })
      .finally(() => { setLoading(false); });
  };

  useEffect(() => { load(); }, []);
  const rangeLabel = useMemo(() => `${formatDate(filters.start)} – ${formatDate(filters.end)}`, [filters.end, filters.start]);

  function toggleCampaign(campaign: Campaign): void {
    setCampaignActive(campaign.id, !campaign.active)
      .then((updated) => { setCampaigns((items) => items.map((item) => item.id === updated.id ? updated : item)); })
      .catch((error: unknown) => { addToast({ id: crypto.randomUUID(), type: "danger", message: (error as { message?: string }).message ?? "Could not update link" }); });
  }

  function changeAdmin(target: AdminUser): void {
    setUserAdmin(target.id, !target.isAdmin)
      .then(() => { setAdminUsers((items) => items.map((item) => item.id === target.id ? { ...item, isAdmin: !item.isAdmin } : item)); addToast({ id: crypto.randomUUID(), type: "success", message: `${target.fullName} is ${target.isAdmin ? "no longer an administrator" : "now an administrator"}. They will sign in again to refresh access.` }); })
      .catch((error: unknown) => { addToast({ id: crypto.randomUUID(), type: "danger", message: (error as { message?: string }).message ?? "Could not update access" }); });
  }

  return (
    <div className="adm-shell">
      <TopBar />
      <header className="adm-hero">
        <div><span className="adm-hero__badge"><i /> Admin analytics</span><h1>Product intelligence</h1></div>
        <div className="adm-hero__meta"><span>Live analytics</span><strong>{rangeLabel}</strong></div>
      </header>
      <nav className="adm-tabs" aria-label="Admin dashboard sections">
        {(["overview", "campaigns", "access"] as Tab[]).map((item) => <button type="button" className={tab === item ? "is-active" : ""} key={item} onClick={() => { setTab(item); }}>{item === "overview" ? "Overview" : item === "campaigns" ? "Attribution links" : "Admin access"}</button>)}
      </nav>
      <main className="adm-main">
        <section className="adm-filters">
          <label>From<input type="date" value={filters.start} max={filters.end} onChange={(event) => { setFilters((current) => ({ ...current, start: event.target.value })); }} /></label>
          <label>To<input type="date" value={filters.end} min={filters.start} max={dateInput(new Date())} onChange={(event) => { setFilters((current) => ({ ...current, end: event.target.value })); }} /></label>
          <label>Reactor type<select value={filters.reactorType} onChange={(event) => { setFilters((current) => ({ ...current, reactorType: event.target.value })); }}><option value="">All reactor types</option>{metrics?.reactorTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <button type="button" className="adm-filter-btn" onClick={load}><Icon name="refresh" /> Apply</button>
          <button type="button" className="adm-export-btn" onClick={() => { void downloadCsv(filters).catch(() => { addToast({ id: crypto.randomUUID(), type: "danger", message: "Could not export CSV" }); }); }}><Icon name="download" /> Export CSV</button>
        </section>

        {loading && metrics === null ? <div className="adm-loading"><span/><p>Assembling product intelligence…</p></div> : metrics !== null && (
          <>
            {tab === "overview" && <>
              <section className="adm-summary-grid">
                <SummaryCard label="Accounts created" value={formatNumber(metrics.summary.accountsCreated)} note="in selected range" icon="users" tone="green" />
                <SummaryCard label="Active practitioners" value={formatNumber(metrics.summary.activeUsers)} note="with measured activity" icon="pulse" tone="blue" />
                <SummaryCard label="Projects created" value={formatNumber(metrics.summary.projectsCreated)} note="across all project types" icon="folder" tone="amber" />
                <SummaryCard label="Tracked time" value={`${formatNumber(metrics.summary.trackedHours)}h`} note="active and idle combined" icon="layers" tone="violet" />
              </section>
              <section className="adm-grid adm-grid--wide">
                <article className="adm-panel adm-panel--trend"><div className="adm-panel-head"><div><p className="adm-kicker">Acquisition</p><h2>Account creation</h2></div><span className="adm-panel-pill">Daily</span></div><TrendChart rows={metrics.accountTrend} /></article>
                <article className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">Engagement</p><h2>Active vs. idle</h2></div></div><ActiveIdle activeMs={metrics.activeIdle.activeMs} idleMs={metrics.activeIdle.idleMs} threshold={metrics.idleThresholdSeconds} /></article>
              </section>
              <section className="adm-grid adm-grid--two">
                <article className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">Project mix</p><h2>Projects by type</h2><p>How newly created projects are distributed across analysis types.</p></div></div><BarList rows={metrics.projectTypes.map((row) => ({ ...row, label: formatProjectType(row.label) }))} color="violet" /></article>
                <article className="adm-panel"><div className="adm-panel-head"><div><p className="adm-kicker">Technical elements</p><h2>Workbooks by technical element</h2><p>Which elements are used most, measured by workbooks created under the selected projects.</p></div></div><BarList rows={metrics.technicalElementWorkbooks} /></article>
              </section>
              <section className="adm-panel adm-sessions"><div className="adm-panel-head"><div><p className="adm-kicker">Session ranking</p><h2>Where each session spent its time</h2><p>Ranked technical-element effort with active time separated from idle thinking time.</p></div><span className="adm-count">Top {Math.min(10, metrics.sessionRanking.length)}</span></div><SessionRanking rows={metrics.sessionRanking} /></section>
            </>}
            {tab === "campaigns" && <CampaignsPanel campaigns={campaigns} onCreated={(campaign) => { setCampaigns((items) => [campaign, ...items]); }} onToggle={toggleCampaign} />}
            {tab === "access" && <AccessPanel users={adminUsers} currentUsername={user?.username ?? ""} onChange={changeAdmin} />}
          </>
        )}
      </main>
    </div>
  );
}

export { AdminPage };
