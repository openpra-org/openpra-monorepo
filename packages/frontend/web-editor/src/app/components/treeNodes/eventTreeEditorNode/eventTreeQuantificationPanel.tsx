/**
 * Event Tree Quantification Panel — thin wrapper around the shared QuantificationPanel.
 *
 * This file contains only what is specific to event trees:
 *   - API wiring (quantifyEventTree — no analyze endpoint yet)
 *   - Result summary (total CDF, sequence count, badges)
 *   - Event Tree Results modal (sequences table with expandable cut sets)
 */
import { useState } from "react";
import type { Criteria, EuiBasicTableColumn } from "@elastic/eui";
import {
  EuiBadge,
  EuiBasicTable,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiProgress,
  EuiSpacer,
  EuiStat,
  EuiText,
} from "@elastic/eui";
import { GraphApiManager } from "shared-sdk/lib/api/GraphApiManager";
import type {
  EventTreeCutSet,
  EventTreeMetadataResult,
  EventTreeOrderStat,
  EventTreeQuantificationResult,
} from "shared-types/src/lib/types/eventTreeQuantification";
import {
  QuantificationPanel,
  OrderStatsTable,
  fmtNumber,
  severityColor,
  approxBadgeLabel,
} from "../quantificationPanel";
import type { QuantificationOptions, OrderStatsRow } from "../quantificationPanel";

// ─── ET Phase 1 metadata display ─────────────────────────────────────────────

function SequenceMetadataRow({
  sequenceId,
  frequency,
  orderStats,
}: {
  sequenceId: string;
  frequency: number;
  orderStats?: EventTreeOrderStat[];
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const freqColor =
    severityColor(frequency, [1e-4, 1e-6]) === "danger" ? "#BD271E"
    : severityColor(frequency, [1e-4, 1e-6]) === "warning" ? "#F5A700"
    : undefined;
  const hasStats = orderStats && orderStats.length > 0;

  const rows: OrderStatsRow[] = (orderStats ?? []).map((s) => ({
    order: s.order,
    count: s.count,
    min: s.minFrequency,
    max: s.maxFrequency,
  }));

  const maxColor = (max: number): string | undefined => {
    const frac = frequency > 0 ? max / frequency : 0;
    return (
      frac >= 0.5 ? "#BD271E"
      : frac >= 0.1 ? "#F5A700"
      : undefined
    );
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <EuiFlexGroup
        gutterSize="xs"
        alignItems="center"
        justifyContent="spaceBetween"
        responsive={false}
      >
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{sequenceId}</EuiBadge>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup
            gutterSize="xs"
            alignItems="center"
            responsive={false}
          >
            <EuiFlexItem grow={false}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: freqColor }}>{fmtNumber(frequency)}</span>
            </EuiFlexItem>
            {hasStats && (
              <EuiFlexItem grow={false}>
                <EuiButtonEmpty
                  size="xs"
                  iconType={expanded ? "arrowUp" : "arrowDown"}
                  onClick={() => setExpanded((v) => !v)}
                  style={{ minWidth: 0, padding: "0 4px", height: 20 }}
                  aria-label={expanded ? "Collapse order stats" : "Expand order stats"}
                />
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
      </EuiFlexGroup>
      {expanded && hasStats && (
        <div style={{ paddingTop: 4, paddingLeft: 4 }}>
          <OrderStatsTable
            rows={rows}
            minLabel="min freq"
            maxLabel="max freq"
            maxColor={maxColor}
          />
        </div>
      )}
    </div>
  );
}

function EventTreeMetadataDisplay({ metadata }: { metadata: EventTreeMetadataResult }): JSX.Element {
  const totalCdf = metadata.totalCdf;
  const cdfColor = severityColor(totalCdf, [1e-4, 1e-6]);

  return (
    <>
      <EuiStat
        title={fmtNumber(totalCdf)}
        description="Exact Total CDF"
        titleColor={cdfColor}
        titleSize="m"
        reverse
      />
      <EuiSpacer size="s" />
      <EuiText
        size="xs"
        color="subdued"
      >
        <strong>Sequences</strong>
        <span style={{ fontWeight: 400, marginLeft: 6 }}>— click ▼ for order distribution</span>
      </EuiText>
      <EuiSpacer size="xs" />
      {[...metadata.sequences]
        .sort((a, b) => a.sequenceId.localeCompare(b.sequenceId, undefined, { numeric: true }))
        .map((seq) => (
          <SequenceMetadataRow
            key={seq.sequenceId}
            sequenceId={seq.sequenceId}
            frequency={seq.frequency}
            orderStats={seq.orderStats}
          />
        ))}
    </>
  );
}

// ─── ET-specific result summary ───────────────────────────────────────────────

function EventTreeResultSummary({
  result,
  onViewDetails,
}: {
  result: EventTreeQuantificationResult;
  onViewDetails: () => void;
}): JSX.Element {
  const totalCdf = result.totalCdf ?? result.sequences.reduce((sum, s) => sum + s.frequency, 0);
  // CDF thresholds differ from probability: 1e-4 danger, 1e-6 warning
  const cdfColor = severityColor(totalCdf, [1e-4, 1e-6]);

  return (
    <>
      <EuiStat
        title={fmtNumber(totalCdf)}
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
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">{approxBadgeLabel(result.approximation)}</EuiBadge>
        </EuiFlexItem>
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
            onClick={onViewDetails}
          >
            View Results
          </EuiButton>
        </>
      )}
    </>
  );
}

// ─── Results modal ────────────────────────────────────────────────────────────

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

function ResultsModal({
  result,
  onClose,
}: {
  result: EventTreeQuantificationResult;
  onClose: () => void;
}): JSX.Element {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalCdf = result.totalCdf ?? result.sequences.reduce((sum, s) => sum + s.frequency, 0);
  const cdfColor = severityColor(totalCdf, [1e-4, 1e-6]);
  const label = approxBadgeLabel(result.approximation);

  const allRows: SequenceRow[] = [...result.sequences]
    .sort((a, b) => a.sequenceId.localeCompare(b.sequenceId, undefined, { numeric: true }))
    .map((seq, idx) => ({
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
          {fmtNumber(f)}
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
                <EuiFlexItem grow={false}>
                  <EuiBadge color="hollow">{label}</EuiBadge>
                </EuiFlexItem>
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
              title={fmtNumber(totalCdf)}
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
              {
                [expandedId]: <CutSetSubTable cutSets={pageRows.find((r) => r.sequenceId === expandedId)!.cutSets} />,
              }
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

function CutSetSubTable({ cutSets }: { cutSets: EventTreeCutSet[] }): JSX.Element {
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
      render: (p: number) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{fmtNumber(p)}</span>,
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

// ─── Public component ─────────────────────────────────────────────────────────

interface EventTreeQuantificationPanelProps {
  eventTreeId: string;
}

export function EventTreeQuantificationPanel({ eventTreeId }: EventTreeQuantificationPanelProps): JSX.Element {
  return (
    <QuantificationPanel<EventTreeQuantificationResult>
      subjectId={eventTreeId}
      onAnalyze={(id) => GraphApiManager.analyzeEventTree(id)}
      renderMetadata={(meta) => <EventTreeMetadataDisplay metadata={meta as EventTreeMetadataResult} />}
      onQuantify={(id, opts: QuantificationOptions) => GraphApiManager.quantifyEventTree(id, opts)}
      renderResult={(result, onViewDetails) => (
        <EventTreeResultSummary
          result={result}
          onViewDetails={onViewDetails}
        />
      )}
      renderModal={(result, onClose) => (
        <ResultsModal
          result={result}
          onClose={onClose}
        />
      )}
      hasDetails={(result) => result.sequences.length > 0}
    />
  );
}
