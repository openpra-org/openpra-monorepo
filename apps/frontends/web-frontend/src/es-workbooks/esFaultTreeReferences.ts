import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { FaultTreeTopEventReference } from "interfaces-mef-types/modeling";

function setFunctionalEventFaultTreeReference(
  analysis: EventSequenceAnalysis,
  eventTreeId: string,
  functionalEventId: string,
  reference: FaultTreeTopEventReference | undefined,
): EventSequenceAnalysis {
  const eventTrees = analysis.eventTrees?.map((tree) => {
    if (tree.uuid !== eventTreeId) return tree;
    const entry = Object.entries(tree.functionalEvents).find(
      ([key, functionalEvent]) => key === functionalEventId || functionalEvent.uuid === functionalEventId,
    );
    if (entry === undefined) return tree;

    const [key, functionalEvent] = entry;
    const {
      faultTreeTopEvent: _previousReference,
      faultTreeId: _legacyReference,
      ...unlinkedFunctionalEvent
    } = functionalEvent;
    return {
      ...tree,
      functionalEvents: {
        ...tree.functionalEvents,
        [key]: reference === undefined
          ? unlinkedFunctionalEvent
          : { ...unlinkedFunctionalEvent, faultTreeTopEvent: reference },
      },
    };
  });

  return eventTrees === undefined ? analysis : { ...analysis, eventTrees };
}

export { setFunctionalEventFaultTreeReference };
