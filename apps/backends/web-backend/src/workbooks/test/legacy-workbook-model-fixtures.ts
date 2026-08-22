const LEGACY_SY_FAULT_TREE_MODEL = {
  uuid: "SY-LEGACY-MODEL",
  systemReference: "SYS-LEGACY-PUMPS",
  description: "Legacy two-train pump fault tree",
  modelRepresentation: "Fault tree",
  faultTree: {
    id: "LEGACY-TOP",
    type: "OR",
    name: "Both credited cooling paths unavailable",
    children: [
      {
        id: "LEGACY-GATE-A",
        type: "AND",
        name: "Train failures",
        children: [
          {
            id: "LEGACY-LEAF-A",
            type: "BE",
            name: "Pump A fails to start",
            be: "BE-LEGACY-PUMP-A",
            mode: "FAILURE_TO_START",
            source: "DA-PUMP-A",
            prob: "0.01",
          },
          {
            id: "LEGACY-LEAF-B",
            type: "BE",
            name: "Pump B fails to run",
            be: "BE-LEGACY-PUMP-B",
            mode: "FAILURE_TO_RUN",
            source: "DA-PUMP-B",
            prob: "0.02",
            ccf: true,
          },
        ],
      },
      {
        id: "LEGACY-TRANSFER",
        type: "TR",
        name: "Support cooling unavailable",
        transfer: "SY-SUPPORT-COOLING",
      },
    ],
  },
  basicEvents: [
    {
      uuid: "BE-LEGACY-PUMP-A",
      name: "Pump A fails to start",
      description: "Demand failure retained from the model-local catalogue",
      eventType: "BASIC",
      componentReference: "PUMP-A",
      failureMode: "FAILURE_TO_START",
      probability: 0.01,
      repairModeled: true,
      repairJustification: "Repair is credited after diagnosis",
      meanTimeToRepair: 4,
      implementsSrs: [],
    },
  ],
  logicLoopResolutions: [{ loopId: "LOOP-1", resolution: "Transfer boundary breaks the support loop" }],
  nomenclature: { PUMP: "Cooling pump" },
  implementsSrs: [],
};

const LEGACY_ES_EVENT_TREE = {
  uuid: "ET-LEGACY-LOFA",
  name: "Legacy loss-of-flow event tree",
  description: "Normalized legacy ES topology retained before typed FT-link migration",
  mitigationStrategy: "Trip the reactor and establish decay-heat removal",
  label: "LOFA",
  initiatingEventId: "IE-LEGACY-LOFA",
  plantOperatingStateId: "POS-LEGACY-POWER",
  functionalEvents: {
    TRIP: {
      uuid: "TRIP",
      name: "Reactor trip",
      label: "RT",
      order: 0,
      description: "Reactor protection response",
      systemReference: "SYS-RPS",
      faultTreeId: "FT-RPS-TRIP",
    },
    DHR: {
      uuid: "DHR",
      name: "Decay-heat removal",
      label: "DHR",
      order: 1,
      description: "At least one cooling path succeeds",
      systemReference: "SYS-DHR",
      faultTreeId: "FT-DHR-TOP",
    },
  },
  sequences: {
    "SEQ-SAFE": {
      uuid: "SEQ-SAFE",
      name: "Successful mitigation",
      label: "S1",
      endState: "SUCCESSFUL_MITIGATION",
      instructions: ["Retain for success-frequency accounting"],
      eventSequenceId: "ES-LEGACY-SAFE",
      functionalEventStates: { TRIP: "SUCCESS", DHR: "SUCCESS" },
    },
    "SEQ-RELEASE": {
      uuid: "SEQ-RELEASE",
      name: "Cooling failure release",
      label: "S2",
      endState: "RADIONUCLIDE_RELEASE",
      eventSequenceId: "ES-LEGACY-RELEASE",
      functionalEventStates: { TRIP: "SUCCESS", DHR: "FAILURE" },
    },
  },
  branches: {
    "BRANCH-TRIP": {
      uuid: "BRANCH-TRIP",
      name: "Reactor trip",
      label: "RT",
      functionalEventId: "TRIP",
      paths: [
        { state: "SUCCESS", target: "BRANCH-DHR", targetType: "BRANCH" },
        {
          state: "FAILURE",
          target: "ET-LEGACY-ATWS",
          targetType: "END_STATE",
          description: "Transfer to the retained ATWS treatment",
        },
      ],
      instructions: ["Preserve the reactor-trip dependency"],
    },
    "BRANCH-DHR": {
      uuid: "BRANCH-DHR",
      name: "Decay-heat removal",
      functionalEventId: "DHR",
      paths: [
        { state: "SUCCESS", target: "SEQ-SAFE", targetType: "SEQUENCE" },
        { state: "FAILURE", target: "SEQ-RELEASE", targetType: "SEQUENCE" },
      ],
    },
  },
  initialState: { branchId: "BRANCH-TRIP" },
  transfers: {
    "ET-LEGACY-ATWS": {
      targetEventTreeId: "ET-LEGACY-ATWS",
      transferConditions: ["Reactor trip fails"],
      preservedDependencies: ["TRIP", "DHR"],
    },
  },
  missionTime: 72,
  missionTimeUnits: "h",
  implementsSrs: [],
};

export { LEGACY_SY_FAULT_TREE_MODEL, LEGACY_ES_EVENT_TREE };
