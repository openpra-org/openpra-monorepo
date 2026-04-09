import { useEffect, useState } from "react";
import {
  EuiFieldNumber,
  EuiFieldText,
  EuiFormRow,
  EuiHorizontalRule,
  EuiSelect,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiTitle,
  EuiLoadingSpinner,
  EuiFlexGroup,
  EuiFlexItem,
} from "@elastic/eui";
import type { Node } from "reactflow";
import type { FaultTreeNodeProps } from "./faultTreeNodeType";
import type {
  BetaParams,
  DistributionParams,
  DistributionType,
  EventType,
  ExponentialParams,
  FaultTreeNodeQuantification,
  GammaParams,
  HouseEventState,
  LognormalParams,
  LognormalTimeParams,
  NormalParams,
  ProbabilityType,
  UniformParams,
  WeibullParams,
} from "../../../types/faultTreeQuantification";
import {
  defaultAtLeastQuantification,
  defaultGateQuantification,
  defaultHouseQuantification,
  defaultQuantification,
} from "../../../types/faultTreeQuantification";
import {
  AND_GATE,
  ATLEAST_GATE,
  BASIC_EVENT,
  HOUSE_EVENT,
  NOT_GATE,
  OR_GATE,
  TRANSFER_GATE,
} from "../../../../utils/constants";
import { GetFaultTrees } from "shared-sdk/lib/api/NestedModelsAPI/FaultTreesApiManager";
import { GetBayesianNetworks } from "shared-sdk/lib/api/NestedModelsAPI/BayesianNetworksApiManager";
import type { NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

// ─── helpers ─────────────────────────────────────────────────────────────────

const LEAF_TYPES = [BASIC_EVENT, HOUSE_EVENT, TRANSFER_GATE];
const GATE_TYPES = [AND_GATE, OR_GATE, NOT_GATE, ATLEAST_GATE];

const PROB_TYPE_OPTIONS = [
  { value: "constant", text: "Constant" },
  { value: "distribution", text: "Distribution" },
  { value: "bayesian_network_link", text: "Bayesian Network Link" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "on_demand", text: "On Demand (per demand probability)" },
  { value: "during_operation", text: "During Operation (rate-based)" },
];

const ON_DEMAND_DIST_OPTIONS = [
  { value: "lognormal", text: "Lognormal" },
  { value: "beta", text: "Beta" },
  { value: "normal", text: "Normal" },
  { value: "uniform", text: "Uniform" },
];

const DURING_OP_DIST_OPTIONS = [
  { value: "exponential", text: "Exponential" },
  { value: "weibull", text: "Weibull" },
  { value: "gamma", text: "Gamma" },
  { value: "lognormal", text: "Lognormal" },
];

const HOUSE_STATE_OPTIONS = [
  { value: "false", text: "False (not occurring)" },
  { value: "true", text: "True (always occurring)" },
];

function labelFor(nodeType: string): string {
  switch (nodeType) {
    case AND_GATE:
      return "AND Gate";
    case OR_GATE:
      return "OR Gate";
    case NOT_GATE:
      return "NOT Gate";
    case ATLEAST_GATE:
      return "At-Least Gate";
    case BASIC_EVENT:
      return "Basic Event";
    case HOUSE_EVENT:
      return "House Event";
    case TRANSFER_GATE:
      return "Transfer Gate";
    default:
      return nodeType;
  }
}

function defaultForType(nodeType: string): FaultTreeNodeQuantification {
  if (nodeType === ATLEAST_GATE) return defaultAtLeastQuantification();
  if (nodeType === HOUSE_EVENT) return defaultHouseQuantification();
  if (GATE_TYPES.includes(nodeType)) return defaultGateQuantification();
  return defaultQuantification();
}

function defaultParamsFor(dist: DistributionType): DistributionParams {
  switch (dist) {
    case "lognormal":
      return { median: 1e-3, errorFactor: 3 } as LognormalParams;
    case "beta":
      return { alpha: 1, betaParam: 1 } as BetaParams;
    case "normal":
      return { mean: 0, stdDev: 1 } as NormalParams;
    case "uniform":
      return { lower: 0, upper: 1 } as UniformParams;
    case "exponential":
      return { failureRate: 1e-5 } as ExponentialParams;
    case "weibull":
      return { scale: 1, shape: 1, location: 0 } as WeibullParams;
    case "gamma":
      return { shape: 1, rate: 1 } as GammaParams;
    default:
      return { mean: 0, stdDev: 1 } as LognormalTimeParams;
  }
}

// ─── sub-panels ──────────────────────────────────────────────────────────────

function ConstantPanel({ value, onChange }: { value: number; onChange: (v: number) => void }): JSX.Element {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = (): void => {
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(Math.min(1, Math.max(0, n)));
  };

  return (
    <EuiFormRow
      label="Probability value"
      helpText="Must be between 0 and 1"
    >
      <EuiFieldNumber
        value={raw}
        min={0}
        max={1}
        step={1e-6}
        onChange={(e) => {
          setRaw(e.target.value);
        }}
        onBlur={commit}
        isInvalid={isNaN(parseFloat(raw)) || parseFloat(raw) < 0 || parseFloat(raw) > 1}
      />
    </EuiFormRow>
  );
}

function LognormalPanel({
  params,
  onChange,
}: {
  params: LognormalParams;
  onChange: (p: LognormalParams) => void;
}): JSX.Element {
  return (
    <>
      <EuiFormRow
        label="Median"
        helpText="Geometric mean (central value)"
      >
        <EuiFieldNumber
          value={params.median}
          step={1e-6}
          onChange={(e) => {
            onChange({ ...params, median: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="Error Factor"
        helpText="EF = exp(1.645 × σ); typically 3–10"
      >
        <EuiFieldNumber
          value={params.errorFactor}
          min={1}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, errorFactor: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function BetaPanel({ params, onChange }: { params: BetaParams; onChange: (p: BetaParams) => void }): JSX.Element {
  return (
    <>
      <EuiFormRow
        label="α (alpha)"
        helpText="Shape parameter — prior successes + 1"
      >
        <EuiFieldNumber
          value={params.alpha}
          min={0.001}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, alpha: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="β (beta)"
        helpText="Shape parameter — prior failures + 1"
      >
        <EuiFieldNumber
          value={params.betaParam}
          min={0.001}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, betaParam: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function NormalPanel({ params, onChange }: { params: NormalParams; onChange: (p: NormalParams) => void }): JSX.Element {
  return (
    <>
      <EuiFormRow label="Mean (μ)">
        <EuiFieldNumber
          value={params.mean}
          step={1e-4}
          onChange={(e) => {
            onChange({ ...params, mean: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="Std Dev (σ)"
        helpText="Must be > 0"
      >
        <EuiFieldNumber
          value={params.stdDev}
          min={0}
          step={1e-4}
          onChange={(e) => {
            onChange({ ...params, stdDev: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function UniformPanel({
  params,
  onChange,
}: {
  params: UniformParams;
  onChange: (p: UniformParams) => void;
}): JSX.Element {
  return (
    <>
      <EuiFormRow label="Lower bound">
        <EuiFieldNumber
          value={params.lower}
          step={1e-4}
          onChange={(e) => {
            onChange({ ...params, lower: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow label="Upper bound">
        <EuiFieldNumber
          value={params.upper}
          step={1e-4}
          onChange={(e) => {
            onChange({ ...params, upper: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function ExponentialPanel({
  params,
  onChange,
}: {
  params: ExponentialParams;
  onChange: (p: ExponentialParams) => void;
}): JSX.Element {
  return (
    <EuiFormRow
      label="Failure Rate λ (per hour)"
      helpText="e.g. 1e-5 failures/hr"
    >
      <EuiFieldNumber
        value={params.failureRate}
        min={0}
        step={1e-7}
        onChange={(e) => {
          onChange({ failureRate: parseFloat(e.target.value) || 0 });
        }}
      />
    </EuiFormRow>
  );
}

function WeibullPanel({
  params,
  onChange,
}: {
  params: WeibullParams;
  onChange: (p: WeibullParams) => void;
}): JSX.Element {
  return (
    <>
      <EuiFormRow
        label="Scale (λ)"
        helpText="Characteristic life"
      >
        <EuiFieldNumber
          value={params.scale}
          min={0}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, scale: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="Shape (β)"
        helpText=">1 ageing, =1 random, <1 infant mortality"
      >
        <EuiFieldNumber
          value={params.shape}
          min={0.001}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, shape: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow
        label="Location (γ)"
        helpText="Threshold; usually 0"
      >
        <EuiFieldNumber
          value={params.location}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, location: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function GammaPanel({ params, onChange }: { params: GammaParams; onChange: (p: GammaParams) => void }): JSX.Element {
  return (
    <>
      <EuiFormRow label="Shape (α)">
        <EuiFieldNumber
          value={params.shape}
          min={0.001}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, shape: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow label="Rate (β = 1/scale)">
        <EuiFieldNumber
          value={params.rate}
          min={0.001}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, rate: parseFloat(e.target.value) || 1 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function LognormalTimePanel({
  params,
  onChange,
}: {
  params: LognormalTimeParams;
  onChange: (p: LognormalTimeParams) => void;
}): JSX.Element {
  return (
    <>
      <EuiFormRow label="Mean (μ, log scale)">
        <EuiFieldNumber
          value={params.mean}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, mean: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
      <EuiFormRow label="Std Dev (σ, log scale)">
        <EuiFieldNumber
          value={params.stdDev}
          min={0}
          step={0.1}
          onChange={(e) => {
            onChange({ ...params, stdDev: parseFloat(e.target.value) || 0 });
          }}
        />
      </EuiFormRow>
    </>
  );
}

function DistributionParamsPanel({
  dist,
  params,
  onChange,
}: {
  dist: DistributionType;
  params: DistributionParams;
  onChange: (p: DistributionParams) => void;
}): JSX.Element {
  switch (dist) {
    case "lognormal":
      // on-demand lognormal uses median + errorFactor
      return (
        <LognormalPanel
          params={params as LognormalParams}
          onChange={onChange}
        />
      );
    case "beta":
      return (
        <BetaPanel
          params={params as BetaParams}
          onChange={onChange}
        />
      );
    case "normal":
      return (
        <NormalPanel
          params={params as NormalParams}
          onChange={onChange}
        />
      );
    case "uniform":
      return (
        <UniformPanel
          params={params as UniformParams}
          onChange={onChange}
        />
      );
    case "exponential":
      return (
        <ExponentialPanel
          params={params as ExponentialParams}
          onChange={onChange}
        />
      );
    case "weibull":
      return (
        <WeibullPanel
          params={params as WeibullParams}
          onChange={onChange}
        />
      );
    case "gamma":
      return (
        <GammaPanel
          params={params as GammaParams}
          onChange={onChange}
        />
      );
    default:
      return (
        <LognormalTimePanel
          params={params as LognormalTimeParams}
          onChange={onChange}
        />
      );
  }
}

// ─── BN Link panel ────────────────────────────────────────────────────────────

function BNLinkPanel({
  modelId,
  bnId,
  bnNodeId,
  onChange,
}: {
  modelId: string;
  bnId: number | undefined;
  bnNodeId: string | undefined;
  onChange: (bnId: number | undefined, bnNodeId: string | undefined) => void;
}): JSX.Element {
  const [bns, setBns] = useState<NestedModelType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void GetBayesianNetworks(modelId)
      .then((list) => {
        if (!cancelled) setBns(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  if (loading) return <EuiLoadingSpinner size="s" />;

  const bnOptions = [
    { value: "", text: "— select a Bayesian Network —" },
    ...bns.map((b) => ({ value: String(b.id), text: b.label?.name ?? String(b.id) })),
  ];

  return (
    <EuiFormRow label="Bayesian Network">
      <EuiSelect
        options={bnOptions}
        value={bnId !== undefined ? String(bnId) : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v ? Number(v) : undefined, undefined);
        }}
      />
    </EuiFormRow>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export interface FaultTreePropertiesPanelProps {
  /** The currently selected ReactFlow node */
  node: Node<FaultTreeNodeProps>;
  /** The typed model ID — needed to fetch sibling fault trees / BNs */
  modelId: string;
  /** Called with the updated quantification whenever a field changes */
  onChange: (nodeId: string, q: FaultTreeNodeQuantification) => void;
}

export function FaultTreePropertiesPanel({ node, modelId, onChange }: FaultTreePropertiesPanelProps): JSX.Element {
  const nodeType = node.type ?? BASIC_EVENT;
  const isLeaf = LEAF_TYPES.includes(nodeType);
  const isAtLeast = nodeType === ATLEAST_GATE;
  const isHouse = nodeType === HOUSE_EVENT;
  const isTransfer = nodeType === TRANSFER_GATE;

  const initial: FaultTreeNodeQuantification = node.data?.quantification ?? defaultForType(nodeType);

  const [q, setQ] = useState<FaultTreeNodeQuantification>(initial);

  // Sync when a different node is selected
  useEffect(() => {
    setQ(node.data?.quantification ?? defaultForType(nodeType));
  }, [node.id, nodeType]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<FaultTreeNodeQuantification>): void => {
    const next = { ...q, ...patch };
    setQ(next);
    onChange(node.id, next);
  };

  // ── Transfer gate: lazy-load sibling fault trees ─────────────────────────
  const [faultTrees, setFaultTrees] = useState<NestedModelType[]>([]);
  useEffect(() => {
    if (!isTransfer) return;
    void GetFaultTrees(modelId)
      .then(setFaultTrees)
      .catch(() => {});
  }, [isTransfer, modelId]);

  const ftOptions = [
    { value: "", text: "— select fault tree —" },
    ...faultTrees
      .filter((ft) => String(ft.id) !== node.id)
      .map((ft) => ({ value: String(ft.id), text: ft.label?.name ?? String(ft.id) })),
  ];

  // ── Distribution type options depend on event type ────────────────────────
  const distOptions = q.eventType === "during_operation" ? DURING_OP_DIST_OPTIONS : ON_DEMAND_DIST_OPTIONS;

  return (
    <div style={{ padding: "12px 16px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <EuiTitle size="xs">
        <h4>{labelFor(nodeType)} Properties</h4>
      </EuiTitle>
      <EuiText
        size="xs"
        color="subdued"
      >
        <p>Node ID: {node.id}</p>
      </EuiText>

      <EuiHorizontalRule margin="s" />

      {/* ── Universal fields ── */}
      <EuiFormRow
        label="Name"
        helpText="Short identifier (e.g. P-001A-FTR)"
      >
        <EuiFieldText
          value={q.name}
          placeholder="Enter name…"
          onChange={(e) => {
            update({ name: e.target.value });
          }}
        />
      </EuiFormRow>

      <EuiFormRow label="Description">
        <EuiTextArea
          value={q.description}
          placeholder="Enter description…"
          rows={3}
          resize="vertical"
          onChange={(e) => {
            update({ description: e.target.value });
          }}
        />
      </EuiFormRow>

      {/* ── At-Least gate: K value ── */}
      {isAtLeast && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiFormRow
            label="K (minimum inputs)"
            helpText="At least K of N inputs must be true"
          >
            <EuiFieldNumber
              value={q.kValue ?? 2}
              min={1}
              step={1}
              onChange={(e) => {
                update({ kValue: parseInt(e.target.value, 10) || 2 });
              }}
            />
          </EuiFormRow>
        </>
      )}

      {/* ── Transfer gate: target fault tree ── */}
      {isTransfer && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiFormRow label="Target Fault Tree">
            <EuiSelect
              options={ftOptions}
              value={q.targetFaultTreeId ?? ""}
              onChange={(e) => {
                update({ targetFaultTreeId: e.target.value || undefined });
              }}
            />
          </EuiFormRow>
        </>
      )}

      {/* ── House event: state ── */}
      {isHouse && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiFormRow
            label="House Event State"
            helpText="Fixed deterministic state"
          >
            <EuiSelect
              options={HOUSE_STATE_OPTIONS}
              value={q.houseEventState ?? "false"}
              onChange={(e) => {
                update({ houseEventState: e.target.value as HouseEventState });
              }}
            />
          </EuiFormRow>
        </>
      )}

      {/* ── Basic event: probability type and parameters ── */}
      {isLeaf && !isHouse && !isTransfer && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiTitle size="xxs">
            <h5>Quantification</h5>
          </EuiTitle>
          <EuiSpacer size="s" />

          <EuiFormRow label="Probability Type">
            <EuiSelect
              options={PROB_TYPE_OPTIONS}
              value={q.probabilityType}
              onChange={(e) => {
                update({
                  probabilityType: e.target.value as ProbabilityType,
                  constantValue: e.target.value === "constant" ? (q.constantValue ?? 0) : q.constantValue,
                  eventType: e.target.value === "distribution" ? (q.eventType ?? "on_demand") : q.eventType,
                });
              }}
            />
          </EuiFormRow>

          {/* Constant */}
          {q.probabilityType === "constant" && (
            <ConstantPanel
              value={q.constantValue ?? 0}
              onChange={(v) => {
                update({ constantValue: v });
              }}
            />
          )}

          {/* Distribution */}
          {q.probabilityType === "distribution" && (
            <>
              <EuiFormRow label="Event Type">
                <EuiSelect
                  options={EVENT_TYPE_OPTIONS}
                  value={q.eventType ?? "on_demand"}
                  onChange={(e) => {
                    const et = e.target.value as EventType;
                    const defaultDist = et === "during_operation" ? "exponential" : "lognormal";
                    update({
                      eventType: et,
                      distributionType: defaultDist,
                      distributionParams: defaultParamsFor(defaultDist),
                    });
                  }}
                />
              </EuiFormRow>

              <EuiFormRow label="Distribution">
                <EuiSelect
                  options={distOptions}
                  value={q.distributionType ?? (q.eventType === "during_operation" ? "exponential" : "lognormal")}
                  onChange={(e) => {
                    const dt = e.target.value as DistributionType;
                    update({
                      distributionType: dt,
                      distributionParams: defaultParamsFor(dt),
                    });
                  }}
                />
              </EuiFormRow>

              {q.distributionType && q.distributionParams && (
                <>
                  <EuiSpacer size="xs" />
                  <EuiText
                    size="xs"
                    color="subdued"
                  >
                    <p>Distribution Parameters</p>
                  </EuiText>
                  <DistributionParamsPanel
                    dist={q.distributionType}
                    params={q.distributionParams}
                    onChange={(p) => {
                      update({ distributionParams: p });
                    }}
                  />
                </>
              )}
            </>
          )}

          {/* BN Link */}
          {q.probabilityType === "bayesian_network_link" && (
            <BNLinkPanel
              modelId={modelId}
              bnId={q.bayesianNetworkId}
              bnNodeId={q.bayesianNetworkNodeId}
              onChange={(bnId, bnNodeId) => {
                update({ bayesianNetworkId: bnId, bayesianNetworkNodeId: bnNodeId });
              }}
            />
          )}
        </>
      )}

      {/* Gates: note that probability is derived from children */}
      {!isLeaf && (
        <>
          <EuiHorizontalRule margin="s" />
          <EuiFlexGroup
            gutterSize="s"
            alignItems="center"
          >
            <EuiFlexItem>
              <EuiText
                size="xs"
                color="subdued"
              >
                <p>Gate probability is computed from child nodes during quantification.</p>
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </>
      )}
    </div>
  );
}
