import { EsqEventTreeHclWorkspace } from "./esqEventTreeHclWorkspace";

function EsqBayesianNetworkWorkspace({
  initialNetworkId = null,
  initialSourceWorkbookId = null,
}: {
  initialNetworkId?: string | null;
  initialSourceWorkbookId?: string | null;
}) {
  return <EsqEventTreeHclWorkspace initialNetworkId={initialNetworkId} initialSourceWorkbookId={initialSourceWorkbookId} />;
}
export { EsqBayesianNetworkWorkspace };
