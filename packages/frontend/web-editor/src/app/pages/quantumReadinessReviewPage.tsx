import React, { useEffect, useMemo, useRef, useState } from "react";

type JsonRecord = Record<string, unknown>;
type JsonValue = JsonRecord | null;

type CardState = {
  loading: boolean;
  error: string | null;
  data: JsonValue;
  rootUsed: string;
};

type QueryConfig = {
  apiBase: string;
  dashboardRootDirectoryPath: string;
  frontendBootstrapPacketRootDirectoryPath: string;
  frontendSeedStateRootDirectoryPath: string;
  rootDirectoryPath: string;
  subtreeRootDirectoryPath: string;
  recoveryRootDirectoryPath: string;
  importanceRootDirectoryPath: string;
  provenanceRootDirectoryPath: string;
  executionRootDirectoryPath: string;
  subtreeId: string;
  caseLabel: string;
  rootGateId: string;
};

const pageStyle: React.CSSProperties = {
  fontFamily: "Arial, Helvetica, sans-serif",
  background: "#f3f5f9",
  minHeight: "100vh",
  padding: "24px",
  color: "#1f2a37",
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d9e0ea",
  borderRadius: "18px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(320px, 1fr))",
  gap: "16px",
  marginTop: "16px",
};

const cardStyle: React.CSSProperties = {
  ...panelStyle,
  padding: "16px",
  minHeight: "320px",
};

const mutedStyle: React.CSSProperties = {
  color: "#5b6877",
  fontSize: "14px",
};

const codeBoxStyle: React.CSSProperties = {
  background: "#f7f9fc",
  border: "1px solid #dfe6ef",
  borderRadius: "10px",
  padding: "12px",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "12px",
  lineHeight: 1.45,
  maxHeight: "420px",
};

const errorBoxStyle: React.CSSProperties = {
  background: "#fff4f4",
  border: "1px solid #f0b7b7",
  color: "#a33a3a",
  borderRadius: "10px",
  padding: "12px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: "12px",
  lineHeight: 1.45,
};

const buttonStyle: React.CSSProperties = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
};

const summaryTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  marginTop: "10px",
};

const summaryKeyCellStyle: React.CSSProperties = {
  verticalAlign: "top",
  padding: "8px 10px 8px 0",
  fontWeight: 700,
  width: "42%",
  borderBottom: "1px solid #eef2f7",
};

const summaryValueCellStyle: React.CSSProperties = {
  verticalAlign: "top",
  padding: "8px 0",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  wordBreak: "break-word",
};

const compactGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
  marginTop: "16px",
};

const compactTileStyle: React.CSSProperties = {
  border: "1px solid #e5ebf3",
  background: "#f8fafc",
  borderRadius: "12px",
  padding: "12px",
  minWidth: 0,
};

const compactLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: "6px",
  fontSize: "14px",
  color: "#0f172a",
};

const compactValueStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const rootsTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "10px",
};

const rootsLabelCellStyle: React.CSSProperties = {
  width: "240px",
  verticalAlign: "top",
  padding: "10px 14px 10px 0",
  fontWeight: 700,
  fontSize: "14px",
  borderBottom: "1px solid #eef2f7",
};

const rootsValueCellStyle: React.CSSProperties = {
  verticalAlign: "top",
  padding: "10px 0",
  borderBottom: "1px solid #eef2f7",
};

const pathPillStyle: React.CSSProperties = {
  display: "block",
  background: "#ffffff",
  border: "1px solid #dfe6ef",
  borderRadius: "10px",
  padding: "8px 10px",
  color: "#475569",
  fontSize: "12px",
  lineHeight: 1.45,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  wordBreak: "break-all",
  overflowWrap: "anywhere",
  maxHeight: "72px",
  overflow: "auto",
};

function getQueryConfig(): QueryConfig {
  const params = new URLSearchParams(window.location.search);

  const rootDirectoryPath = params.get("rootDirectoryPath") ?? "";
  const subtreeRootDirectoryPath = params.get("subtreeRootDirectoryPath") ?? rootDirectoryPath;
  const recoveryRootDirectoryPath = params.get("recoveryRootDirectoryPath") ?? rootDirectoryPath;
  const importanceRootDirectoryPath = params.get("importanceRootDirectoryPath") ?? rootDirectoryPath;
  const provenanceRootDirectoryPath = params.get("provenanceRootDirectoryPath") ?? rootDirectoryPath;
  const executionRootDirectoryPath = params.get("executionRootDirectoryPath") ?? rootDirectoryPath;

  return {
    apiBase: params.get("apiBase") ?? "/api/quantum-readiness",
    dashboardRootDirectoryPath: params.get("dashboardRootDirectoryPath") ?? "",
    frontendBootstrapPacketRootDirectoryPath: params.get("frontendBootstrapPacketRootDirectoryPath") ?? "",
    frontendSeedStateRootDirectoryPath: params.get("frontendSeedStateRootDirectoryPath") ?? "",
    rootDirectoryPath,
    subtreeRootDirectoryPath,
    recoveryRootDirectoryPath,
    importanceRootDirectoryPath,
    provenanceRootDirectoryPath,
    executionRootDirectoryPath,
    subtreeId: params.get("subtreeId") ?? "",
    caseLabel: params.get("caseLabel") ?? "",
    rootGateId: params.get("rootGateId") ?? "",
  };
}

function toPrettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Not available";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value.length > 0 ? value : "Not available";
  }
  return JSON.stringify(value);
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${url} failed with ${response.status}\n${text}`);
  }

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

function buildRootQuery(config: QueryConfig, rootDirectoryPath: string): string {
  const params = new URLSearchParams();
  params.set("rootDirectoryPath", rootDirectoryPath);
  params.set("subtreeId", config.subtreeId);
  params.set("caseLabel", config.caseLabel);
  params.set("rootGateId", config.rootGateId);
  return params.toString();
}

function buildDashboardBody(config: QueryConfig): Record<string, string> {
  const caseContextRoot =
    config.executionRootDirectoryPath ||
    config.provenanceRootDirectoryPath ||
    config.importanceRootDirectoryPath ||
    config.rootDirectoryPath;

  return {
    dashboardRootDirectoryPath: config.dashboardRootDirectoryPath,
    frontendBootstrapPacketRootDirectoryPath: config.frontendBootstrapPacketRootDirectoryPath,
    frontendSeedStateRootDirectoryPath: config.frontendSeedStateRootDirectoryPath,
    rootDirectoryPath: caseContextRoot,
    subtreeId: config.subtreeId,
    caseLabel: config.caseLabel,
    rootGateId: config.rootGateId,
  };
}

function createInitialCardState(rootUsed: string): CardState {
  return {
    loading: false,
    error: null,
    data: null,
    rootUsed,
  };
}

function Badge(props: { tone: "success" | "warning" | "danger" | "info" | "neutral"; text: string }): JSX.Element {
  const toneStyles: Record<string, React.CSSProperties> = {
    success: { background: "#eaf8ef", color: "#166534", border: "1px solid #b7e1c2" },
    warning: { background: "#fff7e6", color: "#9a6700", border: "1px solid #f2d28b" },
    danger: { background: "#fff1f2", color: "#b42318", border: "1px solid #f3c0c6" },
    info: { background: "#eef6ff", color: "#1d4ed8", border: "1px solid #bdd2ff" },
    neutral: { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
  };

  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: "999px",
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: 700,
        ...toneStyles[props.tone],
      }}
    >
      {props.text}
    </span>
  );
}

function SummaryRows(props: { rows: Array<{ key: string; value: React.ReactNode }> }): JSX.Element {
  return (
    <table style={summaryTableStyle}>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.key}>
            <td style={summaryKeyCellStyle}>{row.key}</td>
            <td style={summaryValueCellStyle}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RawPayload(props: { data: JsonValue }): JSX.Element | null {
  if (!props.data) {
    return null;
  }

  return (
    <details style={{ marginTop: "12px", borderTop: "1px solid #e7edf5", paddingTop: "10px" }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>Show raw payload</summary>
      <div style={{ ...codeBoxStyle, marginTop: "10px" }}>{toPrettyJson(props.data)}</div>
    </details>
  );
}

function CompactField(props: { label: string; value: string }): JSX.Element {
  return (
    <div style={compactTileStyle}>
      <div style={compactLabelStyle}>{props.label}</div>
      <div style={compactValueStyle}>{props.value || "NONE"}</div>
    </div>
  );
}

function RootRow(props: { label: string; value: string }): JSX.Element {
  return (
    <tr>
      <td style={rootsLabelCellStyle}>{props.label}</td>
      <td style={rootsValueCellStyle}>
        <div style={pathPillStyle}>{props.value || "NONE"}</div>
      </td>
    </tr>
  );
}

function DashboardSummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const header = asRecord(summary?.header);
  const totals = asRecord(summary?.totals);

  const ready = getBoolean(summary?.readyForFrontend);
  const title = getString(header?.title);
  const subtitle = getString(header?.subtitle);
  const readiness = getString(summary?.readinessStatus);
  const widgetCount = getNumber(totals?.widgetCount);
  const caseRowCount = getNumber(totals?.caseRowCount);

  return (
    <>
      <Badge
        tone={ready ? "success" : "warning"}
        text={ready ? "Dashboard available" : "Dashboard incomplete"}
      />
      <SummaryRows
        rows={[
          { key: "Header", value: title ?? "Not available" },
          { key: "Subtitle", value: subtitle ?? "Not available" },
          { key: "Readiness", value: readiness ?? "Not available" },
          { key: "Widget count", value: formatValue(widgetCount) },
          { key: "Case rows", value: formatValue(caseRowCount) },
        ]}
      />
    </>
  );
}

function SubtreeSummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const topologyAssessment = asRecord(payload?.topologyAssessment);

  const hasRecovery = getBoolean(summary?.hasRecovery);
  const hasImportance = getBoolean(summary?.hasImportanceComparison);

  return (
    <>
      <Badge
        tone={hasRecovery ? "success" : "warning"}
        text={hasRecovery ? "Recovery surfaced" : "Recovery absent"}
      />
      <SummaryRows
        rows={[
          { key: "Topology class", value: formatValue(summary?.topologyClass) },
          { key: "Basic event count", value: formatValue(summary?.basicEventCount) },
          { key: "Required qubits", value: formatValue(summary?.requiredQubits) },
          { key: "Threshold behavior", value: formatValue(summary?.thresholdBehavior) },
          { key: "Has recovery", value: formatValue(hasRecovery) },
          { key: "Has importance", value: formatValue(hasImportance) },
          { key: "Topology narrative", value: formatValue(topologyAssessment?.narrative) },
        ]}
      />
    </>
  );
}

function RecoverySummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const ladder = asRecord(payload?.ladder);

  const exactCount = getNumber(summary?.exactReferenceCutSetCount);
  const tier1Count = getNumber(summary?.tier1RecoveredExactCutSetCount);
  const unionCount = getNumber(summary?.unionRecoveredCount);
  const coverage = getNumber(summary?.recoveryCoverageFraction);
  const primaryMode = getString(summary?.primaryMode);
  const boundedness = getString(summary?.boundednessStatement);
  const recommendation = getString(ladder?.recommendation);

  return (
    <>
      <Badge
        tone={exactCount !== null ? "success" : "warning"}
        text={exactCount !== null ? "Recovery evidence available" : "Recovery evidence limited"}
      />
      <SummaryRows
        rows={[
          { key: "Primary mode", value: primaryMode ?? "Not emitted by artifact" },
          { key: "Exact reference cut sets", value: formatValue(exactCount) },
          { key: "Tier 1 recovered", value: tier1Count ?? "Not emitted by artifact" },
          { key: "Union recovered", value: unionCount ?? "Not emitted by artifact" },
          { key: "Coverage fraction", value: coverage ?? "Not emitted by artifact" },
          { key: "Ladder recommendation", value: recommendation ?? "Not available" },
          { key: "Boundedness statement", value: boundedness ?? "Not available" },
        ]}
      />
    </>
  );
}

function ImportanceSummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const comparison = asRecord(payload?.comparison);
  const interpretation = asRecord(payload?.interpretation);
  const provenance = asRecord(payload?.provenance);
  const matchedArtifactPaths = asArray(provenance?.matchedArtifactPaths);

  const rawSpearman = getNumber(summary?.rawSpearman);
  const birnbaumSpearman = getNumber(summary?.birnbaumSpearman);
  const fvSpearman = getNumber(summary?.fvSpearman);
  const topError = getNumber(summary?.topEventAbsoluteError);
  const boundedness = getString(summary?.boundednessStatement);
  const recommendation = getString(interpretation?.recommendation);

  const available =
    comparison !== null ||
    rawSpearman !== null ||
    birnbaumSpearman !== null ||
    fvSpearman !== null ||
    topError !== null ||
    boundedness !== null;

  return (
    <>
      <Badge
        tone={available ? "success" : "warning"}
        text={available ? "Importance comparison available" : "Importance artifact not present on selected root"}
      />
      <SummaryRows
        rows={[
          { key: "Raw Spearman", value: rawSpearman ?? "Artifact not present" },
          { key: "Birnbaum Spearman", value: birnbaumSpearman ?? "Artifact not present" },
          { key: "FV Spearman", value: fvSpearman ?? "Artifact not present" },
          { key: "Top event absolute error", value: topError ?? "Artifact not present" },
          { key: "Interpretation", value: recommendation ?? "Artifact not present" },
          { key: "Boundedness statement", value: boundedness ?? "Artifact not present" },
          {
            key: "Matched artifact paths",
            value:
              matchedArtifactPaths.length > 0 ?
                `${matchedArtifactPaths.length} matched files`
              : "No matched files reported",
          },
        ]}
      />
    </>
  );
}

function ProvenanceSummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const readiness = asRecord(payload?.readiness);

  const matchedArtifactCount = getNumber(summary?.matchedArtifactCount);
  const exportBundleCount = getNumber(summary?.exportBundleCount);
  const manifestCount = getNumber(summary?.manifestCount);
  const sha256Count = getNumber(summary?.sha256Count);
  const recommendation = getString(readiness?.recommendation);

  return (
    <>
      <Badge
        tone={matchedArtifactCount && matchedArtifactCount > 0 ? "success" : "warning"}
        text={matchedArtifactCount && matchedArtifactCount > 0 ? "Provenance surfaced" : "Provenance limited"}
      />
      <SummaryRows
        rows={[
          { key: "Matched artifacts", value: formatValue(matchedArtifactCount) },
          { key: "Export bundles", value: formatValue(exportBundleCount) },
          { key: "Manifest count", value: formatValue(manifestCount) },
          { key: "SHA256 count", value: formatValue(sha256Count) },
          { key: "Readiness", value: recommendation ?? "Not available" },
        ]}
      />
    </>
  );
}

function ExecutionSummary(props: { data: JsonValue }): JSX.Element {
  const payload = asRecord(props.data);
  const summary = asRecord(payload?.summary);
  const selection = asRecord(payload?.selection);
  const modes = asRecord(payload?.modes);
  const hardware = asRecord(modes?.hardware);

  const recommendedMode = getString(summary?.recommendedMode);
  const currentMode = getString(summary?.currentMode);
  const submissionEnabled = getBoolean(selection?.submissionEnabled);
  const hardwareAvailable = getBoolean(hardware?.available);
  const boundedness = getString(summary?.boundednessStatement);

  return (
    <>
      <Badge
        tone={recommendedMode ? "success" : "warning"}
        text={recommendedMode ? "Execution mode surfaced" : "Execution mode unavailable"}
      />
      <SummaryRows
        rows={[
          { key: "Recommended mode", value: recommendedMode ?? "Not available" },
          { key: "Current mode", value: currentMode ?? "Not available" },
          { key: "Submission enabled", value: formatValue(submissionEnabled) },
          { key: "Hardware available", value: formatValue(hardwareAvailable) },
          { key: "Boundedness statement", value: boundedness ?? "Not available" },
        ]}
      />
    </>
  );
}

function DataCard(props: {
  title: string;
  subtitle: string;
  state: CardState;
  summaryRenderer: (data: JsonValue) => JSX.Element;
}): JSX.Element {
  const { title, subtitle, state, summaryRenderer } = props;

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>{title}</div>
      <div style={{ ...mutedStyle, marginBottom: "10px" }}>{subtitle}</div>
      <div style={{ ...mutedStyle, marginBottom: "10px" }}>
        <strong>root used:</strong> {state.rootUsed || "NONE"}
      </div>

      {state.loading ?
        <div style={mutedStyle}>Loading...</div>
      : state.error ?
        <div style={errorBoxStyle}>{state.error}</div>
      : state.data ?
        <>
          {summaryRenderer(state.data)}
          <RawPayload data={state.data} />
        </>
      : <div style={mutedStyle}>No data loaded yet.</div>}
    </div>
  );
}

export function QuantumReadinessReviewPage(): JSX.Element {
  const config = useMemo(() => getQueryConfig(), []);

  const [dashboard, setDashboard] = useState<CardState>(createInitialCardState(config.dashboardRootDirectoryPath));
  const [subtreeDetail, setSubtreeDetail] = useState<CardState>(
    createInitialCardState(config.subtreeRootDirectoryPath),
  );
  const [recoveryResults, setRecoveryResults] = useState<CardState>(
    createInitialCardState(config.recoveryRootDirectoryPath),
  );
  const [importanceComparison, setImportanceComparison] = useState<CardState>(
    createInitialCardState(config.importanceRootDirectoryPath),
  );
  const [provenanceExport, setProvenanceExport] = useState<CardState>(
    createInitialCardState(config.provenanceRootDirectoryPath),
  );
  const [executionMode, setExecutionMode] = useState<CardState>(
    createInitialCardState(config.executionRootDirectoryPath),
  );
  const [loadingAll, setLoadingAll] = useState(false);

  const didAutoLoadRef = useRef(false);

  async function loadCard(
    setter: React.Dispatch<React.SetStateAction<CardState>>,
    url: string,
    rootUsed: string,
    init?: RequestInit,
  ): Promise<void> {
    setter({
      loading: true,
      error: null,
      data: null,
      rootUsed,
    });

    try {
      const data = await fetchJson(url, init);
      setter({
        loading: false,
        error: null,
        data,
        rootUsed,
      });
    } catch (error) {
      setter({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        data: null,
        rootUsed,
      });
    }
  }

  async function loadReviewerPayloads(): Promise<void> {
    setLoadingAll(true);

    const subtreeQuery = buildRootQuery(config, config.subtreeRootDirectoryPath);
    const recoveryQuery = buildRootQuery(config, config.recoveryRootDirectoryPath);
    const importanceQuery = buildRootQuery(config, config.importanceRootDirectoryPath);
    const provenanceQuery = buildRootQuery(config, config.provenanceRootDirectoryPath);
    const executionQuery = buildRootQuery(config, config.executionRootDirectoryPath);

    try {
      await Promise.all([
        loadCard(setDashboard, `${config.apiBase}/frontend-dashboard-payload`, config.dashboardRootDirectoryPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(buildDashboardBody(config)),
        }),
        loadCard(
          setSubtreeDetail,
          `${config.apiBase}/frontend/subtree-detail-payload?${subtreeQuery}`,
          config.subtreeRootDirectoryPath,
        ),
        loadCard(
          setRecoveryResults,
          `${config.apiBase}/frontend/recovery-results-payload?${recoveryQuery}`,
          config.recoveryRootDirectoryPath,
        ),
        loadCard(
          setImportanceComparison,
          `${config.apiBase}/frontend/importance-comparison-payload?${importanceQuery}`,
          config.importanceRootDirectoryPath,
        ),
        loadCard(
          setProvenanceExport,
          `${config.apiBase}/frontend/provenance-export-payload?${provenanceQuery}`,
          config.provenanceRootDirectoryPath,
        ),
        loadCard(
          setExecutionMode,
          `${config.apiBase}/frontend/execution-mode-selection-payload?${executionQuery}`,
          config.executionRootDirectoryPath,
        ),
      ]);
    } finally {
      setLoadingAll(false);
    }
  }

  useEffect(() => {
    if (didAutoLoadRef.current) {
      return;
    }
    didAutoLoadRef.current = true;
    void loadReviewerPayloads();
  }, []);

  return (
    <div style={pageStyle}>
      <div style={{ ...panelStyle, padding: "22px" }}>
        <div style={{ fontSize: "30px", fontWeight: 700 }}>OpenPRA Quantum Readiness Reviewer Page</div>

        <div style={{ marginTop: "10px", fontSize: "16px", lineHeight: 1.45 }}>
          This page is for bounded reviewer proof only. It renders the quantum readiness dashboard and supporting
          payload views from the running backend using reviewer supplied paths and identifiers.
        </div>

        <div
          style={{
            border: "1px solid #e8c37a",
            background: "#fcf7ea",
            color: "#2f2f2f",
            padding: "12px 14px",
            borderRadius: "12px",
            marginTop: "12px",
          }}
        >
          <strong>Boundedness note:</strong> These views support screening level bounded integration review. They do not
          imply unrestricted production readiness, comparative benefit, or claims beyond the documented project scope.
        </div>

        <div style={{ ...mutedStyle, marginTop: "12px", lineHeight: 1.45 }}>
          Reviewer display behavior: dashboard, recovery, execution mode, and provenance are shown from the selected
          available roots. When a selected root does not contain an importance or ladder artifact, the page labels that
          state explicitly instead of presenting raw null values as if they were errors.
        </div>

        <div style={compactGridStyle}>
          <CompactField
            label="apiBase"
            value={config.apiBase}
          />
          <CompactField
            label="subtreeId"
            value={config.subtreeId}
          />
          <CompactField
            label="caseLabel"
            value={config.caseLabel}
          />
          <CompactField
            label="rootGateId"
            value={config.rootGateId}
          />
        </div>

        <details
          style={{
            marginTop: "14px",
            border: "1px solid #dfe6ef",
            borderRadius: "12px",
            background: "#f8fafc",
            padding: "12px 14px",
          }}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Show selected reviewer roots</summary>

          <table style={rootsTableStyle}>
            <tbody>
              <RootRow
                label="dashboardRootDirectoryPath"
                value={config.dashboardRootDirectoryPath}
              />
              <RootRow
                label="frontendBootstrapPacketRootDirectoryPath"
                value={config.frontendBootstrapPacketRootDirectoryPath}
              />
              <RootRow
                label="frontendSeedStateRootDirectoryPath"
                value={config.frontendSeedStateRootDirectoryPath}
              />
              <RootRow
                label="subtreeRootDirectoryPath"
                value={config.subtreeRootDirectoryPath}
              />
              <RootRow
                label="recoveryRootDirectoryPath"
                value={config.recoveryRootDirectoryPath}
              />
              <RootRow
                label="importanceRootDirectoryPath"
                value={config.importanceRootDirectoryPath}
              />
              <RootRow
                label="provenanceRootDirectoryPath"
                value={config.provenanceRootDirectoryPath}
              />
              <RootRow
                label="executionRootDirectoryPath"
                value={config.executionRootDirectoryPath}
              />
            </tbody>
          </table>
        </details>

        <div style={{ marginTop: "14px" }}>
          <button
            type="button"
            onClick={() => {
              void loadReviewerPayloads();
            }}
            disabled={loadingAll}
            style={{
              ...buttonStyle,
              opacity: loadingAll ? 0.75 : 1,
            }}
          >
            {loadingAll ? "Loading reviewer payloads..." : "Reload reviewer payloads"}
          </button>
        </div>
      </div>

      <div style={gridStyle}>
        <DataCard
          title="1. Dashboard"
          subtitle="POST frontend-dashboard-payload"
          state={dashboard}
          summaryRenderer={(data) => <DashboardSummary data={data} />}
        />
        <DataCard
          title="2. Subtree Detail"
          subtitle="GET frontend/subtree-detail-payload"
          state={subtreeDetail}
          summaryRenderer={(data) => <SubtreeSummary data={data} />}
        />
        <DataCard
          title="3. Recovery Results"
          subtitle="GET frontend/recovery-results-payload"
          state={recoveryResults}
          summaryRenderer={(data) => <RecoverySummary data={data} />}
        />
        <DataCard
          title="4. Importance Comparison"
          subtitle="GET frontend/importance-comparison-payload"
          state={importanceComparison}
          summaryRenderer={(data) => <ImportanceSummary data={data} />}
        />
        <DataCard
          title="5. Provenance Export"
          subtitle="GET frontend/provenance-export-payload"
          state={provenanceExport}
          summaryRenderer={(data) => <ProvenanceSummary data={data} />}
        />
        <DataCard
          title="6. Execution Mode Selection"
          subtitle="GET frontend/execution-mode-selection-payload"
          state={executionMode}
          summaryRenderer={(data) => <ExecutionSummary data={data} />}
        />
      </div>
    </div>
  );
}

export default QuantumReadinessReviewPage;
