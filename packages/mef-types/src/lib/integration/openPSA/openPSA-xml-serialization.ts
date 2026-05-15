export interface OpenPSAFieldMapping {
  openPRAField: string;
  openPSAField: string;
  description?: string;
}
import {
  EventTree,
  EventTreeBranch,
  EventTreeSequence,
  FunctionalEvent,
} from "../../event-sequence-analysis/event-sequence-analysis";
export interface OpenPSASerializable {
  toOpenPSAXML(): string;
  eventTreeToOpenPSAXML(eventTree: EventTree): string;
  openPSAFieldMappings?: Record<string, string>;
  openPSAMetadata?: {
    formatVersion?: string;
    modelType?: "fault-tree" | "event-tree" | "reliability-block";
    modelName?: string;
  };
  openPSAAttributes?: Record<string, any>;
}
export interface OpenPSASerializationOptions {
  prettyPrint?: boolean;
  includeComments?: boolean;
  xmlVersion?: string;
  includeEventTrees?: boolean;
  eventTreeFormat?: "compact" | "verbose";
}
export const DEFAULT_OPENPSA_SERIALIZATION_OPTIONS: OpenPSASerializationOptions = {
  prettyPrint: true,
  includeComments: true,
  xmlVersion: "1.0",
};
export interface EventTreeSerializationOptions {
  format?: "compact" | "verbose";
  includeAttributes?: boolean;
  indent?: number;
  xmlVersion?: string;
}
export const DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS: EventTreeSerializationOptions = {
  format: "verbose",
  includeAttributes: true,
  indent: 2,
  xmlVersion: "1.0",
};
export class EventTreeSerializer {
  static serializeEventTree(
    eventTree: EventTree,
    options: EventTreeSerializationOptions = DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS,
  ): string {
    const { format, includeAttributes, indent, xmlVersion } = {
      ...DEFAULT_EVENT_TREE_SERIALIZATION_OPTIONS,
      ...options,
    };
    const tab = " ".repeat(indent ?? 2);
    let xml = `<?xml version="${xmlVersion}" encoding="UTF-8"?>\n`;
    xml += `<define-event-tree name="${eventTree.name}">\n`;
    if (eventTree.label && includeAttributes) {
      xml += `${tab}<label>${eventTree.label}</label>\n`;
    }
    if (includeAttributes && eventTree.description) {
      xml += `${tab}<attributes>\n`;
      xml += `${tab}${tab}<attribute name="description">${eventTree.description}</attribute>\n`;
      if (eventTree.initiatingEventId) {
        xml += `${tab}${tab}<attribute name="initiating-event">${eventTree.initiatingEventId}</attribute>\n`;
      }
      if (eventTree.missionTime) {
        xml += `${tab}${tab}<attribute name="mission-time">${eventTree.missionTime}</attribute>\n`;
      }
      xml += `${tab}</attributes>\n`;
    }
    Object.values(eventTree.functionalEvents).forEach((funcEvent) => {
      xml += this.serializeFunctionalEvent(funcEvent, tab);
    });
    Object.values(eventTree.sequences).forEach((sequence) => {
      xml += this.serializeSequence(sequence, tab);
    });
    Object.values(eventTree.branches).forEach((branch) => {
      xml += this.serializeBranch(branch, tab, eventTree);
    });
    xml += `${tab}<initial-state>\n`;
    const initialBranch = eventTree.branches[eventTree.initialState.branchId];
    if (initialBranch) {
      xml += this.serializeBranchContent(initialBranch, `${tab}${tab}`, eventTree);
    } else {
      xml += `${tab}${tab}<!-- Error: Initial branch not found -->\n`;
    }
    xml += `${tab}</initial-state>\n`;
    xml += `</define-event-tree>\n`;
    return xml;
  }
  private static serializeFunctionalEvent(functionalEvent: FunctionalEvent, indent: string): string {
    let xml = `${indent}<define-functional-event name="${functionalEvent.name}">\n`;
    if (functionalEvent.label) {
      xml += `${indent}${indent}<label>${functionalEvent.label}</label>\n`;
    }
    if (functionalEvent.description || functionalEvent.systemReference || functionalEvent.humanActionReference) {
      xml += `${indent}${indent}<attributes>\n`;
      if (functionalEvent.description) {
        xml += `${indent}${indent}${indent}<attribute name="description">${functionalEvent.description}</attribute>\n`;
      }
      if (functionalEvent.systemReference) {
        xml += `${indent}${indent}${indent}<attribute name="system-reference">${functionalEvent.systemReference}</attribute>\n`;
      }
      if (functionalEvent.humanActionReference) {
        xml += `${indent}${indent}${indent}<attribute name="human-action-reference">${functionalEvent.humanActionReference}</attribute>\n`;
      }
      if (functionalEvent.order !== undefined) {
        xml += `${indent}${indent}${indent}<attribute name="order">${functionalEvent.order}</attribute>\n`;
      }
      xml += `${indent}${indent}</attributes>\n`;
    }
    xml += `${indent}</define-functional-event>\n`;
    return xml;
  }
  private static serializeSequence(sequence: EventTreeSequence, indent: string): string {
    let xml = `${indent}<define-sequence name="${sequence.name}">\n`;
    if (sequence.label) {
      xml += `${indent}${indent}<label>${sequence.label}</label>\n`;
    }
    if (sequence.instructions && sequence.instructions.length > 0) {
      sequence.instructions.forEach((instruction) => {
        xml += `${indent}${indent}<instruction>${instruction}</instruction>\n`;
      });
    }
    if (sequence.endState || sequence.eventSequenceId || sequence.functionalEventStates) {
      xml += `${indent}${indent}<attributes>\n`;
      if (sequence.endState) {
        xml += `${indent}${indent}${indent}<attribute name="end-state">${sequence.endState}</attribute>\n`;
      }
      if (sequence.eventSequenceId) {
        xml += `${indent}${indent}${indent}<attribute name="event-sequence-id">${sequence.eventSequenceId}</attribute>\n`;
      }
      if (sequence.functionalEventStates) {
        Object.entries(sequence.functionalEventStates).forEach(([eventId, state]) => {
          xml += `${indent}${indent}${indent}<attribute name="state-${eventId}">${state}</attribute>\n`;
        });
      }
      xml += `${indent}${indent}</attributes>\n`;
    }
    xml += `${indent}</define-sequence>\n`;
    return xml;
  }
  private static serializeBranch(branch: EventTreeBranch, indent: string, eventTree: EventTree): string {
    let xml = `${indent}<define-branch name="${branch.name}">\n`;
    if (branch.label) {
      xml += `${indent}${indent}<label>${branch.label}</label>\n`;
    }
    xml += `${indent}${indent}<branch>\n`;
    xml += this.serializeBranchContent(branch, `${indent}${indent}${indent}`, eventTree);
    xml += `${indent}${indent}</branch>\n`;
    xml += `${indent}</define-branch>\n`;
    return xml;
  }
  private static serializeBranchContent(branch: EventTreeBranch, indent: string, eventTree: EventTree): string {
    let xml = "";
    if (branch.functionalEventId) {
      const funcEvent = eventTree.functionalEvents[branch.functionalEventId];
      if (funcEvent) {
        xml += `${indent}<test-functional-event name="${funcEvent.name}">\n`;
      } else {
        xml += `${indent}<test-functional-event name="${branch.functionalEventId}">\n`;
      }
      branch.paths.forEach((path) => {
        let targetXml = "";
        if (path.targetType === "BRANCH") {
          targetXml = `<branch name="${path.target}"/>`;
        } else if (path.targetType === "SEQUENCE") {
          targetXml = `<sequence name="${path.target}"/>`;
        } else if (path.targetType === "END_STATE") {
          targetXml = `<end-state>${path.target}</end-state>`;
        }
        xml += `${indent}${indent}<${path.state.toLowerCase()}>${targetXml}</${path.state.toLowerCase()}>\n`;
      });
      xml += `${indent}</test-functional-event>\n`;
    } else {
      branch.paths.forEach((path) => {
        let targetXml = "";
        if (path.targetType === "BRANCH") {
          targetXml = `<branch name="${path.target}"/>`;
        } else if (path.targetType === "SEQUENCE") {
          targetXml = `<sequence name="${path.target}"/>`;
        } else if (path.targetType === "END_STATE") {
          targetXml = `${path.target}`;
        }
        xml += `${indent}<${path.state.toLowerCase()}>${targetXml}</${path.state.toLowerCase()}>\n`;
      });
    }
    return xml;
  }
}
export const defaultEventTreeSerializer = new EventTreeSerializer();
export function eventTreeToOpenPSAXML(eventTree: EventTree, options?: EventTreeSerializationOptions): string {
  return EventTreeSerializer.serializeEventTree(eventTree, options);
}
export function mapToEventTreeOptions(options: OpenPSASerializationOptions): EventTreeSerializationOptions {
  return {
    format: options.eventTreeFormat ?? "verbose",
    includeAttributes: true,
    indent: options.prettyPrint ? 2 : 0,
    xmlVersion: options.xmlVersion ?? "1.0",
  };
}
