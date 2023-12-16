import {
  DeleteEventSequenceAnalysis,
  GetEventSequenceAnalysis,
  PatchEventSequenceAnalysisLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function EventSequenceAnalysisList() {
  return (
    <NestedModelList
      getNestedEndpoint={GetEventSequenceAnalysis}
      deleteNestedEndpoint={DeleteEventSequenceAnalysis}
      patchNestedEndpoint={PatchEventSequenceAnalysisLabel}
      name="event-sequence-analysis"
    />
  );
}
