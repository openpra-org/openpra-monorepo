import type { EventSequenceAnalysis, FunctionalEvent, FunctionalEventNetworkNode } from "interfaces-mef-types/es/event-sequence-analysis";
import type { FaultTreeTopEventReference } from "interfaces-mef-types/modeling";

type FunctionalEventLink =
  | { kind: "FAULT_TREE"; reference: FaultTreeTopEventReference }
  | { kind: "NETWORK_NODE"; link: FunctionalEventNetworkNode };

function setFunctionalEventLink(
  analysis: EventSequenceAnalysis,
  eventTreeId: string,
  functionalEventId: string,
  link: FunctionalEventLink | undefined,
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
      networkNode: _previousNode,
      faultTreeId: _legacyReference,
      ...unlinkedFunctionalEvent
    } = functionalEvent;
    const next: FunctionalEvent = link === undefined
      ? unlinkedFunctionalEvent
      : link.kind === "FAULT_TREE"
        ? { ...unlinkedFunctionalEvent, faultTreeTopEvent: link.reference }
        : { ...unlinkedFunctionalEvent, networkNode: link.link };
    return {
      ...tree,
      functionalEvents: {
        ...tree.functionalEvents,
        [key]: next,
      },
    };
  });

  return eventTrees === undefined ? analysis : { ...analysis, eventTrees };
}

function setFunctionalEventFaultTreeReference(
  analysis: EventSequenceAnalysis,
  eventTreeId: string,
  functionalEventId: string,
  reference: FaultTreeTopEventReference | undefined,
): EventSequenceAnalysis {
  return setFunctionalEventLink(analysis, eventTreeId, functionalEventId, reference === undefined ? undefined : { kind: "FAULT_TREE", reference });
}

function setFunctionalEventNetworkNode(
  analysis: EventSequenceAnalysis,
  eventTreeId: string,
  functionalEventId: string,
  link: FunctionalEventNetworkNode,
): EventSequenceAnalysis {
  return setFunctionalEventLink(analysis, eventTreeId, functionalEventId, { kind: "NETWORK_NODE", link });
}

export { setFunctionalEventFaultTreeReference, setFunctionalEventNetworkNode };
