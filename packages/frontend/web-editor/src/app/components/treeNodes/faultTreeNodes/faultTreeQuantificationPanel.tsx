/**
 * Fault Tree Quantification Panel
 *
 * Side-panel: algorithm / approximation / max-order controls + Run button.
 * After a successful run it shows a compact probability summary and a
 * "View Cut Set Analysis" button.
 *
 * Results modal (center screen): full paginated EuiBasicTable with columns
 *   Cut Sets | Order | Probability | Contribution
 * Each row occupies exactly one line (truncation + tooltip for long event lists).
 * Pagination lets the user page through all cut sets without any row limit.
 */
import { useState } from "react";
import type { Criteria, EuiBasicTableColumn } from "@elastic/eui";
import {
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiCallOut,
  EuiFieldNumber,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiHorizontalRule,
  EuiLoadingSpinner,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiProgress,
  EuiSelect,
  EuiSpacer,
  EuiStat,
  EuiText,
  EuiTitle,
} from "@elastic/eui";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import type {
  FaultTreeAlgorithm,
  FaultTreeApproximation,
  FaultTreeQuantificationResult,
  ZbddDiagnostics,
} from "shared-types/src/lib/types/faultTreeQuantification";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtProb(p: number): string {
  if (p === 0) return "0";
  if (p < 1e-3) return p.toExponential(3);
  return p.toPrecision(4);
}

// ─── Table row shape ──────────────────────────────────────────────────────────

interface CutSetRow {
  /** 1-based global rank (rank 1 = smallest probability) */
  rank: number;
  events: string[];
  /** number of events = order of the cut set */
  order: number;
  probability: number;
  contribution: number;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface FaultTreeQuantificationPanelProps {
  faultTreeId: string;
}

export function FaultTreeQuantificationPanel({ faultTreeId }: FaultTreeQuantificationPanelProps): JSX.Element {
  const [algorithm, setAlgorithm] = useState<FaultTreeAlgorithm>("zbdd");
  const [approximation, setApproximation] = useState<FaultTreeApproximation>("rare_event");
  const [maxOrder, setMaxOrder] = useState<number | undefined>(undefined);
  const [truncation, setTruncation] = useState<number | undefined>(undefined);

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<FaultTreeQuantificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal is auto-opened after a successful run; can be re-opened via button.
  const [isModalOpen, setIsModalOpen] = useState(false);

  const needsApproximation = algorithm !== "bdd";

  const algorithmOptions = [
    { value: "zbdd", text: "ZBDD" },
    { value: "bdd", text: "BDD" },
  ];

  const approximationOptions = [
    { value: "rare_event", text: "Rare-Event Approximation" },
    { value: "mcub", text: "Min-Cut Upper Bound (MCUB)" },
  ];

  const handleRun = async (): Promise<void> => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await GraphApiManager.quantifyFaultTree(faultTreeId, {
        algorithm,
        ...(needsApproximation ? { approximation } : {}),
        ...(maxOrder !== undefined && maxOrder > 0 ? { maxOrder } : {}),
        ...(truncation !== undefined ? { truncation } : {}),
      });
      setResult(res);
      if (res.cutSets.length > 0) setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quantification failed");
    } finally {
      setIsRunning(false);
    }
  };

  const approxLabel =
    result?.approximation === "rare_event" ? "Rare-Event"
    : result?.approximation === "mcub" ? "MCUB"
    : null;

  const probColor: "danger" | "warning" | "success" =
    !result ? "success"
    : result.topEventProbability >= 0.01 ? "danger"
    : result.topEventProbability >= 1e-4 ? "warning"
    : "success";

  return (
    <>
      {/* ── Side-panel controls ── */}
      <div style={{ padding: "24px 16px 16px" }}>
        <EuiTitle size="xs">
          <h3>Quantification</h3>
        </EuiTitle>
        <EuiSpacer size="s" />

        <EuiFormRow
          label="Algorithm"
          fullWidth
        >
          <EuiSelect
            fullWidth
            options={algorithmOptions}
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value as FaultTreeAlgorithm);
              setError(null);
              setResult(null);
            }}
          />
        </EuiFormRow>

        {needsApproximation && (
          <EuiFormRow
            label="Approximation"
            fullWidth
          >
            <EuiSelect
              fullWidth
              options={approximationOptions}
              value={approximation}
              onChange={(e) => setApproximation(e.target.value as FaultTreeApproximation)}
            />
          </EuiFormRow>
        )}

        <EuiFormRow
          label="Order Limit"
          helpText="Maximum cut-set order. Leave empty for unlimited."
          fullWidth
        >
          <EuiFieldNumber
            fullWidth
            placeholder="Unlimited"
            min={1}
            max={20}
            value={maxOrder ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setMaxOrder(isNaN(v) ? undefined : v);
            }}
          />
        </EuiFormRow>

        <EuiFormRow
          label="Truncation Limit"
          helpText="Cut sets below this probability are excluded (e.g. 1e-9). Leave empty for none."
          fullWidth
        >
          <EuiFieldText
            fullWidth
            placeholder="None"
            value={truncation !== undefined ? truncation.toExponential() : ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const parsed = parseFloat(raw);
              setTruncation(raw === "" || isNaN(parsed) ? undefined : parsed);
            }}
          />
        </EuiFormRow>

        <EuiSpacer size="m" />

        <EuiButton
          fullWidth
          fill
          iconType="play"
          isLoading={isRunning}
          onClick={(): void => void handleRun()}
        >
          {isRunning ? "Running…" : "Quantify"}
        </EuiButton>

        {/* Running indicator */}
        {isRunning && (
          <>
            <EuiSpacer size="s" />
            <EuiFlexGroup
              justifyContent="center"
              alignItems="center"
              gutterSize="s"
            >
              <EuiFlexItem grow={false}>
                <EuiLoadingSpinner size="m" />
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText
                  size="s"
                  color="subdued"
                >
                  Running {algorithm.toUpperCase()}…
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
          </>
        )}

        {/* Error */}
        {error && (
          <>
            <EuiSpacer size="s" />
            <EuiCallOut
              title="Quantification failed"
              color="danger"
              iconType="alert"
              size="s"
            >
              <EuiText size="xs">{error}</EuiText>
            </EuiCallOut>
          </>
        )}

        {/* Compact result summary (replaces full results in the side panel) */}
        {result && !isRunning && (
          <>
            <EuiHorizontalRule margin="m" />
            <EuiStat
              title={fmtProb(result.topEventProbability)}
              description="Top Event Probability"
              titleColor={probColor}
              titleSize="m"
              reverse
            />
            <EuiSpacer size="xs" />
            <EuiFlexGroup
              gutterSize="xs"
              wrap
            >
              <EuiFlexItem grow={false}>
                <EuiBadge color="primary">{result.algorithm.toUpperCase()}</EuiBadge>
              </EuiFlexItem>
              {approxLabel && (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">{approxLabel}</EuiBadge>
                </EuiFlexItem>
              )}
              {result.cutSets.length > 0 && (
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">{result.cutSets.length} cut sets</EuiBadge>
                </EuiFlexItem>
              )}
            </EuiFlexGroup>

            {result.zbddDiagnostics && <ZbddDiagnosticsPanel diagnostics={result.zbddDiagnostics} />}

            {result.cutSets.length > 0 && (
              <>
                <EuiSpacer size="m" />
                <EuiButton
                  fullWidth
                  iconType="tableDensityNormal"
                  onClick={() => setIsModalOpen(true)}
                >
                  View Cut Set Analysis
                </EuiButton>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Cut Set Analysis modal (center screen) ── */}
      {result && isModalOpen && (
        <CutSetAnalysisModal
          result={result}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

// ─── ZBDD Diagnostics panel ───────────────────────────────────────────────────

function ZbddDiagnosticsPanel({ diagnostics }: { diagnostics: ZbddDiagnostics }): JSX.Element {
  return (
    <>
      <EuiSpacer size="s" />
      <EuiFlexGroup
        gutterSize="xs"
        wrap
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiBadge
            color="hollow"
            title="ZBDD nodes"
          >
            {diagnostics.numNodes} nodes
          </EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge
            color="hollow"
            title="Max cut-set order"
          >
            order ≤ {diagnostics.maxProductSize}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
    </>
  );
}

// ─── Cut Set Analysis modal ───────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

function CutSetAnalysisModal({
  result,
  onClose,
}: {
  result: FaultTreeQuantificationResult;
  onClose: () => void;
}): JSX.Element {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Flatten cut sets into table rows (already sorted by increasing probability by the engine)
  const allRows: CutSetRow[] = result.cutSets.map((cs, idx) => ({
    rank: idx + 1,
    events: cs.events,
    order: cs.events.length,
    probability: cs.probability,
    contribution: cs.contribution,
  }));

  const pageRows = allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleTableChange = ({ page }: Criteria<CutSetRow>): void => {
    if (page) {
      setPageIndex(page.index);
      setPageSize(page.size);
    }
  };

  const approxLabel =
    result.approximation === "rare_event" ? "Rare-Event"
    : result.approximation === "mcub" ? "MCUB"
    : null;

  const probColor: "danger" | "warning" | "success" =
    result.topEventProbability >= 0.01 ? "danger"
    : result.topEventProbability >= 1e-4 ? "warning"
    : "success";

  // ── Column definitions ────────────────────────────────────────────────────

  const columns: EuiBasicTableColumn<CutSetRow>[] = [
    {
      field: "rank",
      name: "#",
      width: "44px",
      render: (rank: number) => (
        <EuiText
          size="xs"
          color="subdued"
        >
          {rank}
        </EuiText>
      ),
    },
    {
      field: "events",
      name: "Cut Sets",
      truncateText: true,
      render: (events: string[]) => (
        <span
          style={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}
          title={events.join(", ")}
        >
          {events.join(", ")}
        </span>
      ),
    },
    {
      field: "order",
      name: "Order",
      width: "64px",
      align: "right" as const,
      render: (order: number) => (
        <EuiBadge
          color={
            order === 1 ? "danger"
            : order <= 3 ?
              "warning"
            : "default"
          }
          style={{ fontFamily: "monospace", minWidth: 28, textAlign: "center" }}
        >
          {order}
        </EuiBadge>
      ),
    },
    {
      field: "probability",
      name: "Probability",
      width: "110px",
      align: "right" as const,
      render: (p: number) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{fmtProb(p)}</span>,
    },
    {
      field: "contribution",
      name: "Contribution",
      width: "160px",
      render: (c: number) => {
        const pct = c * 100;
        const color: "success" | "warning" | "danger" =
          pct >= 20 ? "danger"
          : pct >= 5 ? "warning"
          : "success";
        return (
          <EuiFlexGroup
            gutterSize="xs"
            alignItems="center"
            responsive={false}
            style={{ flexWrap: "nowrap" }}
          >
            <EuiFlexItem style={{ minWidth: 70, maxWidth: 70 }}>
              <EuiProgress
                value={pct}
                max={100}
                size="s"
                color={color}
              />
            </EuiFlexItem>
            <EuiFlexItem
              grow={false}
              style={{ minWidth: 48, textAlign: "right" }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 12 }}>{pct.toFixed(1)}%</span>
            </EuiFlexItem>
          </EuiFlexGroup>
        );
      },
    },
  ];

  return (
    <EuiModal
      onClose={onClose}
      maxWidth={960}
      style={{ width: "min(960px, 92vw)" }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <EuiFlexGroup
            alignItems="center"
            gutterSize="m"
            responsive={false}
          >
            <EuiFlexItem grow={false}>Cut Set Analysis</EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup
                gutterSize="xs"
                responsive={false}
              >
                <EuiFlexItem grow={false}>
                  <EuiBadge color="primary">{result.algorithm.toUpperCase()}</EuiBadge>
                </EuiFlexItem>
                {approxLabel && (
                  <EuiFlexItem grow={false}>
                    <EuiBadge color="hollow">{approxLabel}</EuiBadge>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiModalHeaderTitle>
      </EuiModalHeader>

      <EuiModalBody>
        {/* Top-event summary row */}
        <EuiFlexGroup
          alignItems="center"
          gutterSize="xl"
          responsive={false}
        >
          <EuiFlexItem grow={false}>
            <EuiStat
              title={fmtProb(result.topEventProbability)}
              description="Top Event Probability"
              titleColor={probColor}
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiStat
              title={String(result.cutSets.length)}
              description="Minimal Cut Sets"
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiStat
              title={String(Math.min(...result.cutSets.map((cs) => cs.events.length)))}
              description="Min Order"
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiStat
              title={String(Math.max(...result.cutSets.map((cs) => cs.events.length)))}
              description="Max Order"
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiHorizontalRule margin="s" />

        {/* Paginated cut-set table */}
        <EuiBasicTable<CutSetRow>
          tableLayout="fixed"
          items={pageRows}
          columns={columns}
          pagination={{
            pageIndex,
            pageSize,
            totalItemCount: allRows.length,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showPerPageOptions: true,
          }}
          onChange={handleTableChange}
          rowProps={{ style: { height: 36 } }}
        />
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiModalFooter>
    </EuiModal>
  );
}
