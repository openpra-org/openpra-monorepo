/**
 * Generic quantification panel.
 *
 * Handles all shared UI and state:
 *   - Algorithm / Approximation / Mode selectors
 *   - ZBDD two-phase flow (Analyze First) or direct Set Limits flow
 *   - BDD one-shot flow
 *   - Loading / error states
 *   - Phase 1 metadata display (order distribution table)
 *
 * Callers supply three render props that encode the only differences
 * between fault-tree and event-tree quantification:
 *   onAnalyze   — optional; enables the "Analyze First" ZBDD mode
 *   onQuantify  — calls the correct API endpoint
 *   renderResult — renders the compact summary + "View Details" button
 *   renderModal  — renders the full results modal
 *   hasDetails   — whether the result warrants auto-opening the modal
 *
 * Decision matrix (WORKFLOW.md):
 *   Approx × Mode
 *   None (Exact)  + Analyze First  → WF1: BDD cache prob, full ZBDD, metadata shown
 *   Approx        + Analyze First  → WF2: ZBDD approx prob, full ZBDD, metadata shown
 *   None (Exact)  + Set Limits     → WF3: BDD cache prob, on-the-fly pruned ZBDD
 *   Approx        + Set Limits     → WF4: ZBDD approx prob, on-the-fly pruned ZBDD
 */
import type { ReactNode } from "react";
import { useState } from "react";
import {
  EuiBadge,
  EuiButton,
  EuiButtonGroup,
  EuiCallOut,
  EuiFieldNumber,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiFormRow,
  EuiHorizontalRule,
  EuiLoadingSpinner,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTitle,
} from "@elastic/eui";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface QuantificationOptions {
  algorithm: "bdd" | "zbdd";
  approximation?: "rare_event" | "mcub";
  maxOrder?: number;
  truncation?: number;
}

type ZbddApprox = "none" | "rare_event" | "mcub";
type ZbddMode = "analyze" | "limits";

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function fmtNumber(p: number): string {
  if (p === 0) return "0";
  if (p < 1e-3) return p.toExponential(3);
  return p.toPrecision(4);
}

export function severityColor(
  p: number,
  thresholds: [number, number] = [0.01, 1e-4],
): "danger" | "warning" | "success" {
  return (
    p >= thresholds[0] ? "danger"
    : p >= thresholds[1] ? "warning"
    : "success"
  );
}

export function approxBadgeLabel(approx: string | undefined): string {
  if (approx === "rare_event") return "Rare-Event";
  if (approx === "mcub") return "MCUB";
  return "Exact";
}

// ─── Shared order-stats table ─────────────────────────────────────────────────

export interface OrderStatsRow {
  order: number;
  count: number;
  min: number;
  max: number;
}

export interface OrderStatsTableProps {
  rows: OrderStatsRow[];
  minLabel?: string;
  maxLabel?: string;
  maxColor?: (max: number) => string | undefined;
}

export function OrderStatsTable({
  rows,
  minLabel = "Min",
  maxLabel = "Max",
  maxColor,
}: OrderStatsTableProps): JSX.Element {
  if (rows.length === 0) {
    return (
      <EuiText
        size="xs"
        color="subdued"
      >
        No cut sets found.
      </EuiText>
    );
  }

  const sorted = [...rows].sort((a, b) => a.order - b.order);

  return (
    <div>
      <EuiFlexGroup
        gutterSize="none"
        alignItems="center"
        responsive={false}
        style={{ marginBottom: 2 }}
      >
        <EuiFlexItem style={{ minWidth: 36, maxWidth: 36 }} />
        <EuiFlexItem style={{ minWidth: 48, maxWidth: 48 }}>
          <EuiText
            size="xs"
            color="subdued"
            style={{ fontSize: 10, textAlign: "right" }}
          >
            count
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText
            size="xs"
            color="subdued"
            style={{ fontSize: 10, textAlign: "right" }}
          >
            {minLabel}
          </EuiText>
        </EuiFlexItem>
        <EuiFlexItem>
          <EuiText
            size="xs"
            color="subdued"
            style={{ fontSize: 10, textAlign: "right" }}
          >
            {maxLabel}
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>

      {sorted.map((row) => (
        <EuiFlexGroup
          key={row.order}
          gutterSize="none"
          alignItems="center"
          responsive={false}
          style={{ marginBottom: 3 }}
        >
          <EuiFlexItem style={{ minWidth: 36, maxWidth: 36 }}>
            <EuiBadge
              color={
                row.order === 1 ? "danger"
                : row.order <= 3 ?
                  "warning"
                : "default"
              }
              style={{ fontFamily: "monospace", fontSize: 10, padding: "0 5px" }}
            >
              {row.order}
            </EuiBadge>
          </EuiFlexItem>
          <EuiFlexItem style={{ minWidth: 48, maxWidth: 48 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, textAlign: "right", display: "block" }}>
              {row.count}
            </span>
          </EuiFlexItem>
          <EuiFlexItem>
            <span style={{ fontFamily: "monospace", fontSize: 11, textAlign: "right", display: "block" }}>
              {fmtNumber(row.min)}
            </span>
          </EuiFlexItem>
          <EuiFlexItem>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                textAlign: "right",
                display: "block",
                ...(maxColor ? { color: maxColor(row.max) } : {}),
              }}
            >
              {fmtNumber(row.max)}
            </span>
          </EuiFlexItem>
        </EuiFlexGroup>
      ))}
    </div>
  );
}

// ─── Limits sub-form ──────────────────────────────────────────────────────────

interface LimitsFormProps {
  maxOrder: number | undefined;
  truncationText: string;
  disabled: boolean;
  onMaxOrderChange: (v: number | undefined) => void;
  onTruncationChange: (v: string) => void;
}

function LimitsForm({
  maxOrder,
  truncationText,
  disabled,
  onMaxOrderChange,
  onTruncationChange,
}: LimitsFormProps): JSX.Element {
  return (
    <>
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
          disabled={disabled}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onMaxOrderChange(isNaN(v) ? undefined : v);
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
          value={truncationText}
          disabled={disabled}
          onChange={(e) => onTruncationChange(e.target.value)}
        />
      </EuiFormRow>
    </>
  );
}

// ─── Generic panel ────────────────────────────────────────────────────────────

export interface QuantificationPanelProps<R> {
  subjectId: string;
  /**
   * If provided, enables the ZBDD "Analyze First" mode (Phase 1 metadata).
   * Must be paired with renderMetadata.
   */
  onAnalyze?: (subjectId: string) => Promise<unknown>;
  /** Renders the Phase 1 metadata returned by onAnalyze. */
  renderMetadata?: (metadata: unknown) => ReactNode;
  onQuantify: (subjectId: string, options: QuantificationOptions) => Promise<R>;
  /** Compact summary rendered in the side panel. Receives onViewDetails to open the modal. */
  renderResult: (result: R, onViewDetails: () => void) => ReactNode;
  /** Full details modal. */
  renderModal: (result: R, onClose: () => void) => ReactNode;
  /** Whether the result has details worth showing in a modal (controls auto-open). */
  hasDetails: (result: R) => boolean;
}

export function QuantificationPanel<R>({
  subjectId,
  onAnalyze,
  renderMetadata,
  onQuantify,
  renderResult,
  renderModal,
  hasDetails,
}: QuantificationPanelProps<R>): JSX.Element {
  const [algorithm, setAlgorithm] = useState<"bdd" | "zbdd">("zbdd");
  const [zbddApprox, setZbddApprox] = useState<ZbddApprox>("none");
  const [zbddMode, setZbddMode] = useState<ZbddMode>("analyze");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<unknown>(null);

  const [maxOrder, setMaxOrder] = useState<number | undefined>(undefined);
  const [truncationText, setTruncationText] = useState<string>("");

  const [isEnumerating, setIsEnumerating] = useState(false);
  const [result, setResult] = useState<R | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const isRunning = isAnalyzing || isEnumerating;

  const resetAll = (): void => {
    setMetadata(null);
    setResult(null);
    setError(null);
    setIsAnalyzing(false);
    setIsEnumerating(false);
    setMaxOrder(undefined);
    setTruncationText("");
  };

  const handleAnalyze = async (): Promise<void> => {
    if (!onAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setMetadata(null);
    setResult(null);
    try {
      setMetadata(await onAnalyze(subjectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEnumerate = async (): Promise<void> => {
    setIsEnumerating(true);
    setError(null);
    setResult(null);
    const truncation = truncationText !== "" ? parseFloat(truncationText) : undefined;
    try {
      const res = await onQuantify(subjectId, {
        algorithm,
        ...(algorithm === "zbdd" && zbddApprox !== "none" ? { approximation: zbddApprox } : {}),
        ...(maxOrder !== undefined && maxOrder > 0 ? { maxOrder } : {}),
        ...(truncation !== undefined && !isNaN(truncation) ? { truncation } : {}),
      });
      setResult(res);
      if (hasDetails(res)) setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quantification failed");
    } finally {
      setIsEnumerating(false);
    }
  };

  // "Analyze First" mode is available only when onAnalyze is provided.
  // If not provided (e.g. event tree), zbddMode is forced to "limits".
  const effectiveZbddMode: ZbddMode = onAnalyze ? zbddMode : "limits";

  // Phase 2 controls appear:
  //   BDD: always
  //   ZBDD + Set Limits: always
  //   ZBDD + Analyze First: only after metadata is loaded
  const showPhase2 = algorithm === "bdd" || effectiveZbddMode === "limits" || metadata !== null;

  const algorithmOptions = [
    { value: "zbdd", text: "ZBDD" },
    { value: "bdd", text: "BDD" },
  ];

  const approxOptions = [
    { value: "none", text: "None (Exact)" },
    { value: "rare_event", text: "Rare-Event Approximation" },
    { value: "mcub", text: "Min-Cut Upper Bound (MCUB)" },
  ];

  const modeButtons = [
    { id: "analyze", label: "Analyze First" },
    { id: "limits", label: "Set Limits" },
  ];

  return (
    <>
      <div style={{ padding: "24px 16px 16px" }}>
        <EuiTitle size="xs">
          <h3>Quantification</h3>
        </EuiTitle>
        <EuiSpacer size="s" />

        {/* Algorithm */}
        <EuiFormRow
          label="Algorithm"
          fullWidth
        >
          <EuiSelect
            fullWidth
            options={algorithmOptions}
            value={algorithm}
            disabled={isRunning}
            onChange={(e) => {
              setAlgorithm(e.target.value as "bdd" | "zbdd");
              resetAll();
            }}
          />
        </EuiFormRow>

        {/* ZBDD sub-controls */}
        {algorithm === "zbdd" && (
          <>
            <EuiFormRow
              label="Approximation"
              fullWidth
            >
              <EuiSelect
                fullWidth
                options={approxOptions}
                value={zbddApprox}
                disabled={isRunning}
                onChange={(e) => {
                  setZbddApprox(e.target.value as ZbddApprox);
                  resetAll();
                }}
              />
            </EuiFormRow>

            {/* Mode toggle only when Analyze is available */}
            {onAnalyze && (
              <EuiFormRow
                label="Mode"
                fullWidth
              >
                <EuiButtonGroup
                  legend="ZBDD mode"
                  options={modeButtons}
                  idSelected={zbddMode}
                  isDisabled={isRunning}
                  onChange={(id) => {
                    setZbddMode(id as ZbddMode);
                    resetAll();
                  }}
                  buttonSize="compressed"
                  color="primary"
                  isFullWidth
                />
              </EuiFormRow>
            )}
          </>
        )}

        {/* Phase 1: Analyze button (ZBDD + Analyze First only) */}
        {algorithm === "zbdd" && effectiveZbddMode === "analyze" && (
          <>
            <EuiSpacer size="m" />
            <EuiButton
              fullWidth
              fill={metadata === null}
              color={metadata !== null ? "success" : "primary"}
              iconType={metadata !== null ? "refresh" : "inspect"}
              isLoading={isAnalyzing}
              disabled={isEnumerating}
              onClick={(): void => void handleAnalyze()}
            >
              {isAnalyzing ?
                "Analyzing…"
              : metadata !== null ?
                "Re-Analyze"
              : "Analyze"}
            </EuiButton>

            {isAnalyzing && (
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
                      Building BDD + full ZBDD…
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </>
            )}

            {metadata !== null && !isAnalyzing && renderMetadata && (
              <>
                <EuiHorizontalRule margin="m" />
                {renderMetadata(metadata)}
              </>
            )}
          </>
        )}

        {/* Phase 2 / Set Limits / BDD */}
        {showPhase2 && (
          <>
            <EuiHorizontalRule margin="m" />

            {algorithm === "zbdd" && effectiveZbddMode === "analyze" && metadata !== null && (
              <>
                <EuiText
                  size="xs"
                  color="subdued"
                >
                  <strong>Optional: Filter Cut Sets</strong>
                </EuiText>
                <EuiSpacer size="s" />
              </>
            )}

            <LimitsForm
              maxOrder={maxOrder}
              truncationText={truncationText}
              disabled={isEnumerating}
              onMaxOrderChange={setMaxOrder}
              onTruncationChange={setTruncationText}
            />

            <EuiSpacer size="m" />

            <EuiButton
              fullWidth
              fill
              iconType={algorithm === "zbdd" ? "listAdd" : "play"}
              isLoading={isEnumerating}
              disabled={isAnalyzing}
              onClick={(): void => void handleEnumerate()}
            >
              {isEnumerating ?
                "Running…"
              : algorithm === "zbdd" ?
                "Enumerate Cut Sets"
              : "Quantify"}
            </EuiButton>

            {isEnumerating && (
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
                      Enumerating {algorithm.toUpperCase()}…
                    </EuiText>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <>
            <EuiSpacer size="s" />
            <EuiCallOut
              title="Failed"
              color="danger"
              iconType="alert"
              size="s"
            >
              <EuiText size="xs">{error}</EuiText>
            </EuiCallOut>
          </>
        )}

        {/* Result summary (caller-supplied) */}
        {result && !isEnumerating && (
          <>
            <EuiHorizontalRule margin="m" />
            {renderResult(result, () => setIsModalOpen(true))}
          </>
        )}
      </div>

      {/* Result modal (caller-supplied) */}
      {result && isModalOpen && renderModal(result, () => setIsModalOpen(false))}
    </>
  );
}
