import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventSequenceAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getEventSequenceAnalysis}
      deleteNestedEndpoint={NestedModelApiManager.deleteEventSequenceAnalysis}
      patchNestedEndpoint={
        NestedModelApiManager.patchEventSequenceAnalysisLabel
      }
      name="event-sequence-analysis"
    />
  );
}
