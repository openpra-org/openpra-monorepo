import { type JSX, useEffect, useState } from "react";
import type { AnalysisRunProvenance } from "interfaces-shared-types/newly-developed-methods";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { getEsqAnalysisRunProvenance } from "./esqWorkbookApi";
import { EsqAnalysisRunProvenance } from "./esqAnalysisRunProvenance";
import { EsqEventTreeHclWorkspace } from "./esqEventTreeHclWorkspace";

function EsqBayesianNetworkWorkspace(): JSX.Element {
  const { runtime } = useEsqWorkbook();
  const [hasNetwork, setHasNetwork] = useState(false);
  const [provenanceRuns, setProvenanceRuns] = useState<AnalysisRunProvenance[]>([]);
  const [provenanceLoading, setProvenanceLoading] = useState(false);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);
  const [provenanceRefresh, setProvenanceRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (runtime.workbookId === null) {
      setProvenanceRuns([]);
      setProvenanceLoading(false);
      setProvenanceError(null);
      return () => { cancelled = true; };
    }
    setProvenanceLoading(true);
    setProvenanceError(null);
    getEsqAnalysisRunProvenance(runtime.workbookId)
      .then((response) => {
        if (!cancelled) setProvenanceRuns(response.runs);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProvenanceRuns([]);
          setProvenanceError(error instanceof Error ? error.message : "Could not load immutable analysis runs.");
        }
      })
      .finally(() => {
        if (!cancelled) setProvenanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [provenanceRefresh, runtime.workbookId]);

  return (
    <>
      <EsqEventTreeHclWorkspace
        onRunComplete={() => setProvenanceRefresh((current) => current + 1)}
        onNetworkAvailabilityChange={setHasNetwork}
      />
      {hasNetwork && (
        <EsqAnalysisRunProvenance
          runs={provenanceRuns}
          loading={provenanceLoading}
          error={provenanceError}
        />
      )}
    </>
  );
}

export { EsqBayesianNetworkWorkspace };
