import { useState } from "react";
import {
  EuiTitle,
  EuiSpacer,
  EuiFormRow,
  EuiSelect,
  EuiButton,
  EuiLoadingSpinner,
  EuiText,
  EuiCallOut,
  EuiFlexGroup,
  EuiFlexItem,
  EuiBasicTable,
  EuiBadge,
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiButtonEmpty,
  EuiFieldNumber,
  EuiFieldText,
  EuiHorizontalRule,
  EuiStat,
  EuiProgress,
} from "@elastic/eui";
import type { Criteria, EuiBasicTableColumn } from "@elastic/eui";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import type {
  EventTreeAlgorithm,
  EventTreeApproximation,
  EventTreeQuantificationResult,
  EventTreeCutSet,
} from "shared-types/src/lib/types/eventTreeQuantification";

interface EventTreeQuantificationPanelProps {
  eventTreeId: string;
}

function fmtFreq(f: number): string {
  if (f === 0) return "0";
  if (f < 1e-3) return f.toExponential(3);
  return f.toPrecision(4);
}

export function EventTreeQuantificationPanel({ eventTreeId }: EventTreeQuantificationPanelProps): JSX.Element {
  const [algorithm, setAlgorithm] = useState<EventTreeAlgorithm>("zbdd");
  const [approximation, setApproximation] = useState<EventTreeApproximation>("rare_event");
  const [maxOrder, setMaxOrder] = useState<number | undefined>(undefined);
  const [truncation, setTruncation] = useState<number | undefined>(undefined);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<EventTreeQuantificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const needsApproximation = algorithm === "zbdd";

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
      const res = await GraphApiManager.quantifyEventTree(eventTreeId, {
        algorithm,
        ...(needsApproximation ? { approximation } : {}),
        ...(maxOrder !== undefined && maxOrder > 0 ? { maxOrder } : {}),
        ...(truncation !== undefined ? { truncation } : {}),
      });
      setResult(res);
      if (res.sequences.length > 0) setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quantification failed");
    } finally {
      setIsRunning(false);
    }
  };

  const totalCdf = result?.totalCdf ?? result?.sequences.reduce((sum, s) => sum + s.frequency, 0) ?? 0;

  const cdfColor: "danger" | "warning" | "success" =
    totalCdf >= 1e-4 ? "danger"
    : totalCdf >= 1e-6 ? "warning"
    : "success";

  const approxLabel =
    result?.approximation === "rare_event" ? "Rare-Event"
    : result?.approximation === "mcub" ? "MCUB"
    : null;

  return (
    <>
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
              setAlgorithm(e.target.value as EventTreeAlgorithm);
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
              onChange={(e) => setApproximation(e.target.value as EventTreeApproximation)}
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
          helpText="Sequences below this probability are excluded (e.g. 1e-9). Leave empty for none."
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

        {result && !isRunning && (
          <>
            <EuiHorizontalRule margin="m" />
            <EuiStat
              title={fmtFreq(totalCdf)}
              description="Total CDF"
              titleColor={cdfColor}
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
              <EuiFlexItem grow={false}>
                <EuiBadge color="hollow">{result.sequences.length} sequences</EuiBadge>
              </EuiFlexItem>
            </EuiFlexGroup>

            {result.sequences.length > 0 && (
              <>
                <EuiSpacer size="m" />
                <EuiButton
                  fullWidth
                  iconType="tableDensityNormal"
                  onClick={() => setIsModalOpen(true)}
                >
                  View Results
                </EuiButton>
              </>
            )}
          </>
        )}
      </div>

      {result && isModalOpen && (
        <ResultsModal
          result={result}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

interface SequenceRow {
  rank: number;
  sequenceId: string;
  frequency: number;
  cutSets: EventTreeCutSet[];
}

interface CutSetRow {
  rank: number;
  events: string[];
  order: number;
  probability: number;
  contribution: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

function fmtProb(p: number): string {
  if (p === 0) return "0";
  if (p < 1e-3) return p.toExponential(3);
  return p.toPrecision(4);
}

function ResultsModal({ result, onClose }: { result: EventTreeQuantificationResult; onClose: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalCdf = result.totalCdf ?? result.sequences.reduce((sum, s) => sum + s.frequency, 0);

  const cdfColor: "danger" | "warning" | "success" =
    totalCdf >= 1e-4 ? "danger"
    : totalCdf >= 1e-6 ? "warning"
    : "success";

  const approxLabel =
    result.approximation === "rare_event" ? "Rare-Event"
    : result.approximation === "mcub" ? "MCUB"
    : null;

  const allRows: SequenceRow[] = result.sequences.map((seq, idx) => ({
    rank: idx + 1,
    sequenceId: seq.sequenceId,
    frequency: seq.frequency,
    cutSets: seq.cutSets ?? [],
  }));

  const pageRows = allRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleTableChange = ({ page }: Criteria<SequenceRow>): void => {
    if (page) {
      setPageIndex(page.index);
      setPageSize(page.size);
    }
  };

  const freqColor = (f: number): "danger" | "warning" | "success" =>
    f >= 1e-4 ? "danger"
    : f >= 1e-6 ? "warning"
    : "success";

  const columns: EuiBasicTableColumn<SequenceRow>[] = [
    {
      field: "rank",
      name: "#",
      width: "40px",
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
      field: "sequenceId",
      name: "Sequence",
      render: (id: string) => <EuiBadge color="hollow">{id}</EuiBadge>,
    },
    {
      field: "frequency",
      name: "Frequency",
      width: "110px",
      align: "right" as const,
      render: (f: number) => (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color:
              freqColor(f) === "danger" ? "#BD271E"
              : freqColor(f) === "warning" ? "#F5A700"
              : undefined,
          }}
        >
          {fmtFreq(f)}
        </span>
      ),
    },
    {
      field: "cutSets",
      name: "Cut Sets",
      width: "80px",
      align: "right" as const,
      render: (cutSets: EventTreeCutSet[]) =>
        cutSets.length > 0 ?
          <EuiBadge
            color="hollow"
            style={{ cursor: "pointer" }}
          >
            {cutSets.length}
          </EuiBadge>
        : <EuiText
            size="xs"
            color="subdued"
          >
            —
          </EuiText>,
    },
    {
      name: "",
      width: "48px",
      actions: [
        {
          name: "Expand",
          description: "Show cut sets",
          icon: (row: SequenceRow) => (expandedId === row.sequenceId ? "arrowUp" : "arrowDown"),
          type: "icon" as const,
          available: (row: SequenceRow) => row.cutSets.length > 0,
          onClick: (row: SequenceRow) => setExpandedId(expandedId === row.sequenceId ? null : row.sequenceId),
        },
      ],
    },
  ];

  return (
    <EuiModal
      onClose={onClose}
      maxWidth={1000}
      style={{ width: "min(1000px, 94vw)" }}
    >
      <EuiModalHeader>
        <EuiModalHeaderTitle>
          <EuiFlexGroup
            alignItems="center"
            gutterSize="m"
            responsive={false}
          >
            <EuiFlexItem grow={false}>Event Tree Results</EuiFlexItem>
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
        <EuiFlexGroup
          alignItems="center"
          gutterSize="xl"
          responsive={false}
        >
          <EuiFlexItem grow={false}>
            <EuiStat
              title={fmtFreq(totalCdf)}
              description="Total CDF"
              titleColor={cdfColor}
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiStat
              title={String(result.sequences.length)}
              description="Sequences"
              titleSize="m"
              reverse
            />
          </EuiFlexItem>
        </EuiFlexGroup>

        <EuiHorizontalRule margin="s" />

        <EuiBasicTable<SequenceRow>
          tableLayout="fixed"
          items={pageRows}
          columns={columns}
          itemId="sequenceId"
          itemIdToExpandedRowMap={
            expandedId !== null && pageRows.some((r) => r.sequenceId === expandedId) ?
              { [expandedId]: <CutSetSubTable cutSets={pageRows.find((r) => r.sequenceId === expandedId)!.cutSets} /> }
            : {}
          }
          pagination={{
            pageIndex,
            pageSize,
            totalItemCount: allRows.length,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showPerPageOptions: true,
          }}
          onChange={handleTableChange}
          rowProps={{ style: { height: 40 } }}
        />
      </EuiModalBody>

      <EuiModalFooter>
        <EuiButtonEmpty onClick={onClose}>Close</EuiButtonEmpty>
      </EuiModalFooter>
    </EuiModal>
  );
}

function CutSetSubTable({ cutSets }: { cutSets: EventTreeCutSet[] }) {
  const rows: CutSetRow[] = cutSets.map((cs, idx) => ({
    rank: idx + 1,
    events: cs.events,
    order: cs.events.length,
    probability: cs.probability,
    contribution: cs.contribution,
  }));

  const columns: EuiBasicTableColumn<CutSetRow>[] = [
    {
      field: "rank",
      name: "#",
      width: "40px",
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
      name: "Cut Set",
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
    <div style={{ padding: "8px 16px 16px" }}>
      <EuiBasicTable<CutSetRow>
        tableLayout="fixed"
        items={rows}
        columns={columns}
        rowProps={{ style: { height: 36 } }}
      />
    </div>
  );
}
