import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { type JSX, useCallback, useEffect, useState } from "react";
import { fetchJson } from "../api/client";
import { SeismicPraDocumentsCard } from "./seismicPraDocumentsCard";
import { SeismicPraWorkbookProvider } from "./seismicPraWorkbookContext";
import { SeismicPraWorkbench, type SeismicPraPersona } from "./seismicPraWorkbench";

interface BundleResponse { seismicPra: { mef: SeismicPRA } }

function SeismicPraDemoPage(): JSX.Element {
  const [mef, setMef] = useState<SeismicPRA | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<SeismicPraPersona>("preparer");
  useEffect(() => { let cancelled = false; fetchJson<BundleResponse>("/api/example-workbooks/seismic-pra-bundle").then((response) => { if (!cancelled) setMef(response.seismicPra.mef); }).catch((err: unknown) => { if (!cancelled) setError((err as { message?: string }).message ?? "Could not load the Seismic PRA example"); }); return () => { cancelled = true; }; }, []);
  const mutate = useCallback((mutator: (current: SeismicPRA) => SeismicPRA): void => setMef((current) => current === null ? current : mutator(current)), []);
  if (error !== null) return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  if (mef === null) return <div className="posw"><main className="posmain"><p className="pws-status">Loading Seismic PRA example…</p></main></div>;
  return <SeismicPraWorkbookProvider mef={mef} editable={persona === "preparer"} mutate={mutate}><SeismicPraWorkbench persona={persona} setPersona={setPersona} headerMeta={{ projectName: mef.metadata.plantIdentity?.name ?? "Reference plant", workbookName: mef.name, workbookVersion: mef.version }} renderDocuments={() => <SeismicPraDocumentsCard canEdit={persona === "preparer"} />} /></SeismicPraWorkbookProvider>;
}

export { SeismicPraDemoPage };
