import { useState, type ReactNode } from "react";
import type { EventTreeSequenceDiagnostics } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type {
  HclBatchCompilationStats,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { PagedResults } from "../shared/resultPresentation";

function DiagnosticsDisclosure({ label, children }: { label: string; children: () => ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className="hcleditor__diagnostics"
      aria-label={label}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{label}</summary>
      {expanded && <div className="hcleditor__diagnostics-body">{children()}</div>}
    </details>
  );
}

function DiagnosticCounts({ values }: { values: ReadonlyArray<readonly [string, number]> }) {
  return (
    <dl className="hcleditor__diagnostic-counts">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HclCompilationDiagnostics({ stats }: { stats?: HclBatchCompilationStats }) {
  return (
    <DiagnosticsDisclosure label="Batch compilation diagnostics">
      {() => (
        <>
          {stats === undefined ?
            <p>Compilation counts were not recorded for this batch.</p>
          : <>
              <p>Counts cover the entire evidence batch. Uncertainty sample-chunk compilations are excluded.</p>
              <DiagnosticCounts
                values={[
                  "bddCompilations" in stats ?
                    ["FT BDD compilations", stats.bddCompilations]
                  : ["Sequence BDD compilations", stats.sequenceBddCompilations],
                  ["Base BN junction-tree compilations", stats.junctionTreeCompilations],
                  ["Evaluated evidence rows", stats.scenarioEvaluations],
                ]}
              />
            </>
          }
        </>
      )}
    </DiagnosticsDisclosure>
  );
}

export function HclSolverDiagnostics({
  diagnostics,
  resetKey,
}: {
  diagnostics?: EventTreeSequenceDiagnostics;
  resetKey: string;
}) {
  return (
    <DiagnosticsDisclosure label="Solver diagnostics">
      {() => (
        <>
          {diagnostics === undefined ?
            <p>Solver diagnostics were not recorded for this result.</p>
          : <>
              <p>Point-probability pass only. Counters exclude uncertainty sampling and hazard-weight queries.</p>
              {diagnostics.bdd === null ?
                <p>No BDD built: unconditional sequence.</p>
              : <>
                  <DiagnosticCounts
                    values={[
                      ["Allocated BDD nodes (excluding terminals)", diagnostics.bdd.nodes],
                      ["BDD variables", diagnostics.bdd.variables],
                    ]}
                  />
                  <p>
                    Node counts may include intermediate nodes. Variable order is the actual compiled order of
                    basic-event IDs.
                  </p>
                  <PagedResults
                    items={diagnostics.bdd.variableOrder.map((id, index) => ({ id, position: index + 1 }))}
                    label="BDD variable order"
                    resetKey={resetKey}
                  >
                    {(page) => (
                      <ol
                        className="hcleditor__variable-order"
                        start={page[0]?.position ?? 1}
                        aria-label="Actual BDD variable order"
                      >
                        {page.map(({ id, position }) => (
                          <li key={position}>{id}</li>
                        ))}
                      </ol>
                    )}
                  </PagedResults>
                </>
              }
              <h5>HCL bridge — this scenario</h5>
              {diagnostics.bridge === null ?
                <p>HCL bridge not used for this sequence.</p>
              : <>
                  <DiagnosticCounts
                    values={[
                      ["Point evaluations", diagnostics.bridge.quantifications],
                      ["BDD-context cache hits", diagnostics.bridge.bddContextCacheHits],
                      ["BDD-context cache misses", diagnostics.bridge.bddContextCacheMisses],
                      ["BN-query cache hits", diagnostics.bridge.bnQueryCacheHits],
                      ["BN-query cache misses", diagnostics.bridge.bnQueryCacheMisses],
                    ]}
                  />
                  <p>
                    A hit reuses a stored answer; a miss requires a calculation. Evidence changes clear these caches.
                  </p>
                </>
              }
              <h5>Base BN junction tree</h5>
              {diagnostics.junctionTree === null ?
                <p>No Bayesian network used.</p>
              : <>
                  <DiagnosticCounts
                    values={[
                      ["Cliques", diagnostics.junctionTree.numCliques],
                      ["Largest clique (variables)", diagnostics.junctionTree.maxCliqueSize],
                      ["Treewidth", diagnostics.junctionTree.treewidth],
                      ["Total table entries", diagnostics.junctionTree.totalTableEntries],
                    ]}
                  />
                  <p>
                    Cliques are groups of BN variables used for inference. Treewidth is the largest clique size minus
                    one.
                  </p>
                </>
              }
            </>
          }
        </>
      )}
    </DiagnosticsDisclosure>
  );
}

export function HclFaultTreeDiagnostics({ result }: { result: HclQuantificationResult }) {
  return (
    <HclSolverDiagnostics
      key={result.runId}
      resetKey={result.runId}
      diagnostics={{
        bdd: { nodes: result.bddNodes, variables: result.bddVariables, variableOrder: result.variableOrder },
        bridge: result.bridge,
        junctionTree: result.junctionTree,
      }}
    />
  );
}
