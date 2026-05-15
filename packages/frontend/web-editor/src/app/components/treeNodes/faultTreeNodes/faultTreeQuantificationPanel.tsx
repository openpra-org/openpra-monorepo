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
  FaultTreeMetadataResult,
  FaultTreeQuantificationResult,
  OrderStats,
  ZbddDiagnostics,
} from "shared-types/src/lib/types/faultTreeQuantification";
import {
  QuantificationPanel,
  OrderStatsTable,
  fmtNumber,
  severityColor,
  approxBadgeLabel,
} from "../quantificationPanel";
import type { QuantificationOptions, OrderStatsRow } from "../quantificationPanel";
function FaultTreeMetadataDisplay({ metadata }: { metadata: FaultTreeMetadataResult }): JSX.Element {
  const rows: OrderStatsRow[] = metadata.orderStats.map((s) => ({
    order: s.order,
    count: s.count,
    min: s.minProbability,
    max: s.maxProbability,
  }));
  return (
    <>
      <EuiStat
        title={fmtNumber(metadata.topEventProbability)}
        description="Exact Top-Event Probability"
        titleColor={severityColor(metadata.topEventProbability)}
        titleSize="m"
        reverse
      />
      <EuiSpacer size="s" />
      <EuiText
        size="xs"
        color="subdued"
      >
        <strong>MCS Order Distribution</strong>
      </EuiText>
      <EuiSpacer size="xs" />
      <OrderStatsTable
        rows={rows}
        minLabel="min prob"
        maxLabel="max prob"
      />
    </>
  );
}
function FaultTreeResultSummary({
  result,
  onViewDetails,
}: {
  result: FaultTreeQuantificationResult;
  onViewDetails: () => void;
}): JSX.Element {
  return (
    <>
      <EuiStat
        title={fmtNumber(result.topEventProbability)}
        description="Top Event Probability"
        titleColor={severityColor(result.topEventProbability)}
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
        {result.cutSets.length > 0 && (
          <EuiFlexItem grow={false}>
            <EuiBadge color="hollow">{result.cutSets.length} cut sets</EuiBadge>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {result.zbddDiagnostics && <ZbddDiagnosticsPanel diagnostics={result.zbddDiagnostics} />}

      {result.orderStats && result.orderStats.length > 0 && (
        <>
          <EuiSpacer size="s" />
          <EuiText
            size="xs"
            color="subdued"
          >
            <strong>MCS Order Distribution (filtered)</strong>
          </EuiText>
          <EuiSpacer size="xs" />
          <OrderStatsBadges orderStats={result.orderStats} />
        </>
      )}

      {result.cutSets.length > 0 && (
        <>
          <EuiSpacer size="m" />
          <EuiButton
            fullWidth
            iconType="tableDensityNormal"
            onClick={onViewDetails}
          >
            View Cut Set Analysis
          </EuiButton>
        </>
      )}
    </>
  );
}
function OrderStatsBadges({ orderStats }: { orderStats: OrderStats[] }): JSX.Element {
  return (
    <EuiFlexGroup
      gutterSize="xs"
      wrap
    >
      {[...orderStats]
        .sort((a, b) => a.order - b.order)
        .map((row) => (
          <EuiFlexItem
            key={row.order}
            grow={false}
          >
            <EuiBadge
              color={
                row.order === 1 ? "danger"
                : row.order <= 3 ?
                  "warning"
                : "hollow"
              }
            >
              order {row.order}: {row.count}
            </EuiBadge>
          </EuiFlexItem>
        ))}
    </EuiFlexGroup>
  );
}
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
interface CutSetRow {
  rank: number;
  events: string[];
  order: number;
  probability: number;
  contribution: number;
}
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
  const topProb = result.topEventProbability;
  const label = approxBadgeLabel(result.approximation);
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
              title={fmtNumber(topProb)}
              description="Top Event Probability"
              titleColor={severityColor(topProb)}
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
          {result.cutSets.length > 0 && (
            <>
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
            </>
          )}
        </EuiFlexGroup>

        <EuiHorizontalRule margin="s" />

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
interface FaultTreeQuantificationPanelProps {
  faultTreeId: string;
}
export function FaultTreeQuantificationPanel({ faultTreeId }: FaultTreeQuantificationPanelProps): JSX.Element {
  return (
    <QuantificationPanel<FaultTreeQuantificationResult>
      subjectId={faultTreeId}
      onAnalyze={(id) => GraphApiManager.analyzeFaultTree(id)}
      renderMetadata={(meta) => <FaultTreeMetadataDisplay metadata={meta as FaultTreeMetadataResult} />}
      onQuantify={(id, opts: QuantificationOptions) => GraphApiManager.quantifyFaultTree(id, opts)}
      renderResult={(result, onViewDetails) => (
        <FaultTreeResultSummary
          result={result}
          onViewDetails={onViewDetails}
        />
      )}
      renderModal={(result, onClose) => (
        <CutSetAnalysisModal
          result={result}
          onClose={onClose}
        />
      )}
      hasDetails={(result) => result.cutSets.length > 0}
    />
  );
}
