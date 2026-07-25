import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { SeismicPraDocumentsCard } from "./seismicPraDocumentsCard";
import { fetchSeismicPraLinkedInputs, type SeismicPraExampleOption } from "./seismicPraWorkbookApi";
import { SeismicPraWorkbookProvider, type SeismicPraLinkedInputs, type SeismicPraVariant } from "./seismicPraWorkbookContext";
import { SeismicPraWorkbench, type SeismicPraPersona } from "./seismicPraWorkbench";

interface BundleResponse { seismicPra: { mef: SeismicPRA } }

function SeismicPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<SeismicPRA | null>(null);
  const [linkedInputs, setLinkedInputs] = useState<SeismicPraLinkedInputs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<SeismicPraPersona>("preparer");
  const [examples, setExamples] = useState<SeismicPraExampleOption[]>([]);
  const [selected, setSelected] = useState<SeismicPraVariant>("htgr");
  useEffect(() => {
    let cancelled = false;
    setMef(null);
    setLinkedInputs(null);
    setError(null);
    Promise.all([
      fetchJson<BundleResponse>(`/api/example-workbooks/seismic-pra-bundle?example=${encodeURIComponent(selected)}`),
      fetchJson<SeismicPraExampleOption[]>("/api/example-workbooks/seismic-pra-examples"),
      fetchSeismicPraLinkedInputs(selected).catch(() => null),
    ])
      .then(([response, options, links]) => {
        if (cancelled) return;
        setMef(response.seismicPra.mef);
        setExamples(options);
        setLinkedInputs(links);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as { message?: string }).message ?? "Could not load the Seismic PRA example");
      });
    return () => { cancelled = true; };
  }, [selected]);
  const mutate = useCallback((mutator: (current: SeismicPRA) => SeismicPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  const selectExample = useCallback((value: string): void => {
    setMef(null);
    setLinkedInputs(null);
    setSelected(value as SeismicPraVariant);
  }, []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Seismic PRA example…</p></main></div>;
  const activeLinkedInputs = linkedInputs?.variant === selected ? linkedInputs : null;
  return <SeismicPraWorkbookProvider mef={mef} linkedInputs={activeLinkedInputs} editable={persona === "preparer"} mutate={mutate}><SeismicPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderDocuments={() => <SeismicPraDocumentsCard canEdit={persona === "preparer"} />} renderSignCard={() => <WorkbookDemoSignCard persona={persona} myOpenComments={0} submitted preparerPhase={false} onReviewerApproverSigned={() => undefined} onPreparerSigned={() => undefined} />} exampleOptions={examples} selectedExample={selected} onSelectExample={selectExample} /></SeismicPraWorkbookProvider>;
}

export { SeismicPraDemoPage };
