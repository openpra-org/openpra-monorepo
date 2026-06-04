import { EndState } from "./event-sequence-analysis";
export interface ConceptualEventTree {
  name: string;
  label?: string;
  initiatingEventId: string;
  plantOperatingStateId?: string;
  functionalEvents: Record<string, ConceptualFunctionalEvent>;
  branches: Record<string, ConceptualBranch>;
  sequences: Record<string, ConceptualSequence>;
  initialState: {
    branchId: string;
  };
  description?: string;
  missionTime?: number;
  missionTimeUnits?: string;
  mappedEventSequences?: Record<string, ConceptualEventSequence>;
}
export interface ConceptualFunctionalEvent {
  name: string;
  label?: string;
  description?: string;
  systemReference?: string;
  humanActionReference?: string;
  order?: number;
}
export interface ConceptualBranch {
  name: string;
  label?: string;
  functionalEventId?: string;
  paths: ConceptualPath[];
}
export interface ConceptualPath {
  state: "SUCCESS" | "FAILURE";
  target: string;
  targetType: "BRANCH" | "SEQUENCE" | "END_STATE";
  description?: string;
}
export interface ConceptualSequence {
  name: string;
  label?: string;
  endState?: string;
  instructions?: string[];
  eventSequenceId?: string;
  functionalEventStates?: Record<string, "SUCCESS" | "FAILURE">;
}
export interface ConceptualEventSequence {
  id: string;
  name: string;
  description?: string;
  initiatingEventId: string;
  plantOperatingStateId: string;
  progression: string;
  systemResponses: Record<string, "SUCCESS" | "FAILURE">;
  operatorActions?: string[];
  timing?: Array<{
    event: string;
    timeAfterInitiator: number;
  }>;
  endState: string;
  eventTreeId: string;
  eventTreeSequenceId: string;
}
export function createConceptualEventTree(): ConceptualEventTree {
  const functionalEvents: Record<string, ConceptualFunctionalEvent> = {
    "FE-EDG": {
      name: "FE-EDG",
      label: "Emergency Diesel Generator",
      description: "EDG starts and runs for mission time",
      systemReference: "SYS-EDG",
      order: 1,
    },
    "FE-BATT": {
      name: "FE-BATT",
      label: "Battery Power",
      description: "DC power from batteries is available",
      systemReference: "SYS-DC",
      order: 2,
    },
    "FE-PORVs": {
      name: "FE-PORVs",
      label: "PORVs for RCS Cooling",
      description: "Power-operated relief valves for decay heat removal",
      systemReference: "SYS-RCS",
      order: 3,
    },
    "FE-OP-REC": {
      name: "FE-OP-REC",
      label: "Operator Recovers Power",
      description: "Operator action to recover AC power",
      humanActionReference: "HRA-001",
      order: 4,
    },
  };
  const branches: Record<string, ConceptualBranch> = {
    "BR-INIT": {
      name: "BR-INIT",
      label: "Initial Branch",
      functionalEventId: "FE-EDG",
      paths: [
        {
          state: "SUCCESS",
          target: "BR-EDG-S",
          targetType: "BRANCH",
          description: "EDG starts and runs successfully",
        },
        {
          state: "FAILURE",
          target: "BR-EDG-F",
          targetType: "BRANCH",
          description: "EDG fails to start or run",
        },
      ],
    },
    "BR-EDG-S": {
      name: "BR-EDG-S",
      label: "EDG Success Branch",
      functionalEventId: "FE-PORVs",
      paths: [
        {
          state: "SUCCESS",
          target: "SEQ-1",
          targetType: "SEQUENCE",
          description: "PORVs operate successfully",
        },
        {
          state: "FAILURE",
          target: "SEQ-2",
          targetType: "SEQUENCE",
          description: "PORVs fail to operate",
        },
      ],
    },
    "BR-EDG-F": {
      name: "BR-EDG-F",
      label: "EDG Failure Branch",
      functionalEventId: "FE-BATT",
      paths: [
        {
          state: "SUCCESS",
          target: "BR-BATT-S",
          targetType: "BRANCH",
          description: "DC power is available",
        },
        {
          state: "FAILURE",
          target: "SEQ-5",
          targetType: "SEQUENCE",
          description: "Loss of all power",
        },
      ],
    },
    "BR-BATT-S": {
      name: "BR-BATT-S",
      label: "Battery Success Branch",
      functionalEventId: "FE-OP-REC",
      paths: [
        {
          state: "SUCCESS",
          target: "SEQ-3",
          targetType: "SEQUENCE",
          description: "Operator recovers power",
        },
        {
          state: "FAILURE",
          target: "SEQ-4",
          targetType: "SEQUENCE",
          description: "Operator fails to recover power",
        },
      ],
    },
  };
  const sequences: Record<string, ConceptualSequence> = {
    "SEQ-1": {
      name: "SEQ-1",
      label: "Success Path",
      endState: EndState.SUCCESSFUL_MITIGATION,
      instructions: ["Transfer to safe shutdown"],
      eventSequenceId: "ES-LOOP-1",
      functionalEventStates: {
        "FE-EDG": "SUCCESS",
        "FE-PORVs": "SUCCESS",
      },
    },
    "SEQ-2": {
      name: "SEQ-2",
      label: "EDG Success, PORV Failure",
      endState: EndState.RADIONUCLIDE_RELEASE,
      instructions: ["Model core damage"],
      eventSequenceId: "ES-LOOP-2",
      functionalEventStates: {
        "FE-EDG": "SUCCESS",
        "FE-PORVs": "FAILURE",
      },
    },
    "SEQ-3": {
      name: "SEQ-3",
      label: "EDG Failure, Battery Success, Recovery Success",
      endState: EndState.SUCCESSFUL_MITIGATION,
      instructions: ["Transfer to safe shutdown"],
      eventSequenceId: "ES-LOOP-3",
      functionalEventStates: {
        "FE-EDG": "FAILURE",
        "FE-BATT": "SUCCESS",
        "FE-OP-REC": "SUCCESS",
      },
    },
    "SEQ-4": {
      name: "SEQ-4",
      label: "EDG Failure, Battery Success, Recovery Failure",
      endState: EndState.RADIONUCLIDE_RELEASE,
      instructions: ["Model core damage"],
      eventSequenceId: "ES-LOOP-4",
      functionalEventStates: {
        "FE-EDG": "FAILURE",
        "FE-BATT": "SUCCESS",
        "FE-OP-REC": "FAILURE",
      },
    },
    "SEQ-5": {
      name: "SEQ-5",
      label: "Station Blackout",
      endState: EndState.RADIONUCLIDE_RELEASE,
      instructions: ["Model core damage"],
      eventSequenceId: "ES-LOOP-5",
      functionalEventStates: {
        "FE-EDG": "FAILURE",
        "FE-BATT": "FAILURE",
      },
    },
  };
  const eventSequences: Record<string, ConceptualEventSequence> = {
    "ES-LOOP-1": {
      id: "ES-LOOP-1",
      name: "Loss of Offsite Power with Successful AC and Cooling",
      description: "Loss of offsite power followed by successful EDG start and PORV cooling",
      initiatingEventId: "IE-LOOP",
      plantOperatingStateId: "POS-POWER",
      progression: "LOOP → EDG starts → AC power available → PORVs operate → Core cooling maintained",
      systemResponses: {
        "SYS-EDG": "SUCCESS",
        "SYS-RCS": "SUCCESS",
      },
      timing: [
        { event: "Loss of Offsite Power", timeAfterInitiator: 0 },
        { event: "EDG Start", timeAfterInitiator: 0.1 },
        { event: "PORV Operation", timeAfterInitiator: 0.5 },
      ],
      endState: EndState.SUCCESSFUL_MITIGATION,
      eventTreeId: "ET-LOOP",
      eventTreeSequenceId: "SEQ-1",
    },
    "ES-LOOP-2": {
      id: "ES-LOOP-2",
      name: "Loss of Offsite Power with AC but PORV Failure",
      description: "Loss of offsite power with EDG success but PORV failure",
      initiatingEventId: "IE-LOOP",
      plantOperatingStateId: "POS-POWER",
      progression: "LOOP → EDG starts → AC power available → PORVs fail → Inadequate cooling → Core damage",
      systemResponses: {
        "SYS-EDG": "SUCCESS",
        "SYS-RCS": "FAILURE",
      },
      timing: [
        { event: "Loss of Offsite Power", timeAfterInitiator: 0 },
        { event: "EDG Start", timeAfterInitiator: 0.1 },
        { event: "PORV Failure", timeAfterInitiator: 0.5 },
        { event: "Core Damage Onset", timeAfterInitiator: 3.0 },
      ],
      endState: EndState.RADIONUCLIDE_RELEASE,
      eventTreeId: "ET-LOOP",
      eventTreeSequenceId: "SEQ-2",
    },
    "ES-LOOP-3": {
      id: "ES-LOOP-3",
      name: "Loss of Offsite Power with EDG Failure but Recovery",
      description: "LOOP with EDG failure, battery success, and operator recovery of power",
      initiatingEventId: "IE-LOOP",
      plantOperatingStateId: "POS-POWER",
      progression: "LOOP → EDG fails → Battery power available → Operator recovers power → Core cooling maintained",
      systemResponses: {
        "SYS-EDG": "FAILURE",
        "SYS-DC": "SUCCESS",
      },
      operatorActions: ["HRA-001"],
      timing: [
        { event: "Loss of Offsite Power", timeAfterInitiator: 0 },
        { event: "EDG Failure", timeAfterInitiator: 0.1 },
        { event: "Operator Recovery", timeAfterInitiator: 1.0 },
      ],
      endState: EndState.SUCCESSFUL_MITIGATION,
      eventTreeId: "ET-LOOP",
      eventTreeSequenceId: "SEQ-3",
    },
    "ES-LOOP-4": {
      id: "ES-LOOP-4",
      name: "Loss of Offsite Power with EDG Failure and Failed Recovery",
      description: "LOOP with EDG failure, battery success, but operator fails to recover power",
      initiatingEventId: "IE-LOOP",
      plantOperatingStateId: "POS-POWER",
      progression: "LOOP → EDG fails → Battery power available → Operator fails to recover power → Core damage",
      systemResponses: {
        "SYS-EDG": "FAILURE",
        "SYS-DC": "SUCCESS",
      },
      operatorActions: ["HRA-001"],
      timing: [
        { event: "Loss of Offsite Power", timeAfterInitiator: 0 },
        { event: "EDG Failure", timeAfterInitiator: 0.1 },
        { event: "Operator Recovery Failure", timeAfterInitiator: 2.0 },
        { event: "Core Damage Onset", timeAfterInitiator: 4.0 },
      ],
      endState: EndState.RADIONUCLIDE_RELEASE,
      eventTreeId: "ET-LOOP",
      eventTreeSequenceId: "SEQ-4",
    },
    "ES-LOOP-5": {
      id: "ES-LOOP-5",
      name: "Station Blackout",
      description: "LOOP with EDG failure and battery failure",
      initiatingEventId: "IE-LOOP",
      plantOperatingStateId: "POS-POWER",
      progression: "LOOP → EDG fails → Battery power unavailable → Complete loss of power → Core damage",
      systemResponses: {
        "SYS-EDG": "FAILURE",
        "SYS-DC": "FAILURE",
      },
      timing: [
        { event: "Loss of Offsite Power", timeAfterInitiator: 0 },
        { event: "EDG Failure", timeAfterInitiator: 0.1 },
        { event: "Battery Failure", timeAfterInitiator: 0.2 },
        { event: "Core Damage Onset", timeAfterInitiator: 2.0 },
      ],
      endState: EndState.RADIONUCLIDE_RELEASE,
      eventTreeId: "ET-LOOP",
      eventTreeSequenceId: "SEQ-5",
    },
  };
  const eventTree: ConceptualEventTree = {
    name: "ET-LOOP",
    label: "Loss of Offsite Power Event Tree",
    initiatingEventId: "IE-LOOP",
    plantOperatingStateId: "POS-POWER",
    description: "Models plant response following a loss of offsite power",
    functionalEvents,
    branches,
    sequences,
    initialState: {
      branchId: "BR-INIT",
    },
    missionTime: 24,
    missionTimeUnits: "hours",
    mappedEventSequences: eventSequences,
  };
  return eventTree;
}
export function stringifyConceptualEventTree(): string {
  const eventTree = createConceptualEventTree();
  return JSON.stringify(eventTree, null, 2);
}
export function printEventTreeDiagram(): string {
  return `
  IE-LOOP
    |
    |-- EDG?
        |
        |-- Success --> PORVs?
        |      |
        |      |-- Success --> SEQ-1 (OK) [ES-LOOP-1]
        |      |
        |      |-- Failure --> SEQ-2 (CD) [ES-LOOP-2]
        |
        |-- Failure --> BATT?
               |
               |-- Success --> OP-REC?
               |      |
               |      |-- Success --> SEQ-3 (OK) [ES-LOOP-3]
               |      |
               |      |-- Failure --> SEQ-4 (CD) [ES-LOOP-4]
               |
               |-- Failure --> SEQ-5 (CD) [ES-LOOP-5]
  
  Legend:
  OK = Successful Mitigation
  CD = Core Damage (Radionuclide Release)
  [ES-LOOP-X] = Corresponding Event Sequence
  `;
}
export function explainEventTreeSequenceRelationship(): string {
  return `
  EVENT TREE TO EVENT SEQUENCE RELATIONSHIP:
  ------------------------------------------
  
  For the Loss of Offsite Power (LOOP) event tree:
  
  1. The event tree represents a structured, graphical model of possible progression paths
     following a loss of offsite power initiating event.
     
  2. Each path through the event tree (from initiating event to end state) corresponds to
     a unique event sequence, representing a specific chronological progression of events.
     
  3. For example:
     - The path IE-LOOP → EDG Success → PORVs Success → SEQ-1 corresponds to event sequence ES-LOOP-1
     - The path IE-LOOP → EDG Failure → Battery Failure → SEQ-5 corresponds to event sequence ES-LOOP-5
     
  4. The event tree models multiple possible event sequences at once, capturing all the ways
     the scenario might unfold based on the success or failure of systems and operator actions.
     
  5. The event tree allows for quantifying the frequencies of different sequences by assigning
     probabilities to each branch point and calculating combined probabilities for each path.
     
  6. Dependencies between events in the sequence (e.g., how one system's failure affects another)
     can be captured in the event tree structure or in the branch point probabilities.
  `;
}
if (require.main === module) {
  console.log(printEventTreeDiagram());
  console.log("\nEvent Tree to Event Sequence Relationship:");
  console.log(explainEventTreeSequenceRelationship());
  console.log("\nDetailed Event Tree Structure (with event sequences):");
  console.log(stringifyConceptualEventTree());
}
