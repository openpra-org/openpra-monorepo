import { eventTreeSequenceLabel, eventTreeResultName } from "./eventTreeResultLabels";
import type { EventTreeEditorProps } from "./eventTreeTypes";
import { PagedResults, ResultNumber } from "../shared/resultPresentation";

export function EventTreeTransferResults({
  model, availableTransfers, analysisResult,
}: Pick<EventTreeEditorProps, "model" | "availableTransfers" | "analysisResult">) {
  const sequences = analysisResult?.sequences.filter((sequence) => sequence.sequenceChain !== undefined) ?? [];
  if (sequences.length === 0) return null;
  const name = eventTreeResultName(model, availableTransfers);
  return (
    <section aria-label="Transferred sequence results" className="et-editor__table-wrap">
      <h3>Transferred paths</h3>
      <PagedResults items={sequences} label="Transferred sequences" resetKey={analysisResult!.runId}>{(page) => <table className="postable et-editor__table">
        <thead><tr><th>Complete path</th><th>Outcomes</th><th>Probability</th><th>Annual frequency</th></tr></thead>
        <tbody>{page.map((sequence) => (
          <tr key={sequence.sequenceId}>
            <td>{eventTreeSequenceLabel(sequence, name)}</td>
            <td>{sequence.path.map((step) => step.outcome).join(" → ")}</td>
            <td><ResultNumber value={sequence.conditionalProbability} /></td>
            <td><ResultNumber value={sequence.annualFrequency} /></td>
          </tr>
        ))}</tbody>
      </table>}</PagedResults>
    </section>
  );
}
