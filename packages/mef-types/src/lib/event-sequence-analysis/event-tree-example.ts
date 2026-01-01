/**
 * @module event_tree_example
 * @description Example demonstrating the conceptual structure of event trees in OpenPRA
 * and their relationship to event sequences
 *
 * Note: This is a conceptual example showing the structure of event trees.
 * This file doesn't implement the actual interfaces to avoid validation errors
 * with specific required field formats. In a real implementation, the proper
 * Unique, Named, and other interface requirements would need to be satisfied.
 */

import { EndState } from "./event-sequence-analysis";

/**
 * Event Tree Conceptual Structure
 *
 * This shows the conceptual structure of an event tree without implementing
 * the exact interfaces, which would require specific format requirements.
 *
 * An event tree is a graphical method used to model and depict event sequences.
 * It starts with an initiating event and branches at various "top events"
 * (functional events), with each branch representing a possible outcome.
 * @hidden
 */
export interface ConceptualEventTree {
  name: string;
  label?: string;
  initiatingEventId: string; // Reference to the initiating event that starts this tree
  plantOperatingStateId?: string;
  functionalEvents: Record<string, ConceptualFunctionalEvent>; // Top events at branch points
  branches: Record<string, ConceptualBranch>; // Branch points with success/failure paths
  sequences: Record<string, ConceptualSequence>; // End points of event tree paths
  initialState: {
    branchId: string; // First branch after initiating event
  };
  description?: string;
  missionTime?: number;
  missionTimeUnits?: string;

  // Each event tree can map to multiple event sequences
  // Each sequence is a unique path through the event tree
  mappedEventSequences?: Record<string, ConceptualEventSequence>;
}

/**
 * Functional Event (Top Event) in an event tree
 * These represent systems, components, or operator actions that can succeed or fail
 * @hidden
 */
export interface ConceptualFunctionalEvent {
  name: string;
  label?: string;
  description?: string;
  systemReference?: string; // Reference to system model
  humanActionReference?: string; // Reference to human action model
  order?: number; // Chronological order in sequence
}

/**
 * Branch point in an event tree
 * Each branch contains a functional event and paths following success/failure
 * @hidden
 */
export interface ConceptualBranch {
  name: string;
  label?: string;
  functionalEventId?: string; // Reference to the functional event at this branch
  paths: ConceptualPath[]; // Success and failure paths from this branch
}

/**
 * Path from a branch point
 * Represents the success or failure of the functional event
 * @hidden
 */
export interface ConceptualPath {
  state: "SUCCESS" | "FAILURE"; // Outcome of the functional event
  target: string; // Where this path leads (branch, sequence, or end state)
  targetType: "BRANCH" | "SEQUENCE" | "END_STATE"; // Type of target
  description?: string;
}

/**
 * Sequence (end point) in an event tree
 * Each sequence represents a specific path through the event tree
 * @hidden
 */
export interface ConceptualSequence {
  name: string;
  label?: string;
  endState?: string; // Final outcome (e.g., SUCCESSFUL_MITIGATION or RADIONUCLIDE_RELEASE)
  instructions?: string[];
  eventSequenceId?: string; // Reference to the corresponding event sequence
  functionalEventStates?: Record<string, "SUCCESS" | "FAILURE">; // States of all functional events on this path
}

/**
 * Event sequence corresponding to a path through an event tree
 * An event sequence is a chronological progression of events from an initiating event
 * to a specific end state, accounting for system/component/operator responses.
 * @hidden
 */
export interface ConceptualEventSequence {
  id: string;
  name: string;
  description?: string;
  initiatingEventId: string; // Same as in the event tree
  plantOperatingStateId: string;

  // The chronological progression of events in this sequence
  progression: string;

  // System responses along this sequence path
  systemResponses: Record<string, "SUCCESS" | "FAILURE">;

  // Operator actions involved in this sequence
  operatorActions?: string[];

  // Timing information for key events
  timing?: Array<{
    event: string;
    timeAfterInitiator: number;
  }>;

  // End state of this sequence
  endState: string;

  // Connection to event tree
  eventTreeId: string; // Reference to the event tree that models this sequence
  eventTreeSequenceId: string; // Reference to the specific sequence in the event tree
}

/**
 * Create a simple example event tree for a Loss of Offsite Power (LOOP) scenario
 * @returns A sample conceptual event tree with mapped event sequences
 * @hidden
 *
 */
export function createConceptualEventTree(): ConceptualEventTree {
  // Define functional events (systems or operator actions that can succeed or fail)
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

  // Define branches for the event tree
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

  // Define sequences (end points of the event tree)
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

  // Define the corresponding event sequences
  // These represent the actual chronological event progressions modeled by the event tree
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

  // Create the event tree
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
    // Map the event sequences that correspond to paths through this event tree
    mappedEventSequences: eventSequences,
  };

  return eventTree;
}

/**
 * Demonstrate event tree serialization
 * @returns String representation of the event tree
 * @hidden
 */
export function stringifyConceptualEventTree(): string {
  const eventTree = createConceptualEventTree();
  return JSON.stringify(eventTree, null, 2);
}

/**
 * Example of how one might represent the event tree in a diagram format.
 * Note: This is a text representation for illustration purposes.
 *
 * Each path through the event tree represents a unique event sequence.
 * @hidden
 */
export function printEventTreeDiagram(): string {
  // Simple ASCII representation of the event tree
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

/**
 * Demonstrate the relationship between event trees and event sequences
 * @returns String representation explaining the relationship
 * @group Event Trees
 */
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

// Example usage
if (require.main === module) {
  console.log(printEventTreeDiagram());
  console.log("\nEvent Tree to Event Sequence Relationship:");
  console.log(explainEventTreeSequenceRelationship());
  console.log("\nDetailed Event Tree Structure (with event sequences):");
  console.log(stringifyConceptualEventTree());
}
