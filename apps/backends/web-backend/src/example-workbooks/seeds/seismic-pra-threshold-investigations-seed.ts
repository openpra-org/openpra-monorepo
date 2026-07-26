import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Equipment =
  SeismicPRA["seismicPlantResponseAnalysis"]["seismicEquipmentListDevelopment"]["equipment"][number];
type Investigation =
  SeismicPRA["seismicFragilityAnalysis"]["plantInvestigations"][number];
type Finding = Investigation["findings"][number];

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function team(
  prefix: string,
  members: Array<{
    name: string;
    role: string;
    seismic: string;
    walkdown?: string;
    systems?: string;
    qualifications: string[];
  }>,
): Investigation["team"] {
  return members.map((member, index) => ({
    uuid: `${prefix}-TEAM-${index + 1}`,
    name: member.name,
    organization: "OpenPRA Reference Program",
    role: member.role,
    seismicPerformanceExperience: member.seismic,
    walkdownExperience: member.walkdown,
    systemsOrOperationsExperience: member.systems,
    qualifications: member.qualifications,
  }));
}

function finding(
  uuid: string,
  name: string,
  item: Equipment,
  findingType: Finding["findingType"],
  description: string,
  affectedFunctionOrAction: string,
  treatment: string,
  evidenceRefs: string[],
  potentiallyRiskSignificant = false,
): Finding {
  return {
    uuid,
    name,
    sscRef: item.uuid,
    findingType,
    description,
    location: [item.building, item.roomOrArea, item.elevation]
      .filter((value) => value !== undefined && value.length > 0)
      .join(" | "),
    credible: true,
    potentiallyRiskSignificant,
    affectedFunctionOrAction,
    affectedFailureModeRefs: item.failureModes.map((mode) => mode.uuid),
    resolutionOrFragilityTreatment: treatment,
    evidenceRefs,
    implementsSrs: srs(
      "SFR-D2",
      "SFR-D4",
      findingType === "FLOOD_SOURCE"
        ? "SFR-D6"
        : findingType === "FIRE_SOURCE"
          ? "SFR-D7"
          : findingType === "INTERACTION"
              || findingType === "FALLING_HAZARD"
              || findingType === "CLEARANCE"
            ? "SFR-D8"
            : "SFR-D5",
    ),
  };
}

function unique(items: Equipment[]): Equipment[] {
  return Array.from(new Map(items.map((item) => [item.uuid, item])).values());
}

export function populateThresholdsAndInvestigations(
  mef: SeismicPRA,
  kind: ReactorKind,
  reactorBuilding: string,
): void {
  const isSfr = kind === "sfr";
  const prefix = kind.toUpperCase();
  const sfr = mef.seismicFragilityAnalysis;
  const sel =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
  const equipment = sel.equipment;
  const screened = equipment.filter((item) => item.disposition !== "ACTIVE");
  const active = equipment.filter((item) => item.disposition === "ACTIVE");
  const floodSources = equipment.filter((item) => item.sscType === "FLOOD_SOURCE");
  const fireSources = equipment.filter((item) => item.sscType === "FIRE_SOURCE");
  const electrical = equipment.filter((item) =>
    ["RELAY", "PANEL", "CABINET"].includes(item.sscType)
    || /battery|switchgear|charger/i.test(item.name));
  const passive = equipment.filter((item) =>
    ["STRUCTURE", "OTHER"].includes(item.sscType)
    || /vessel|piping|header|duct|vault/i.test(item.name));
  const mechanical = equipment.filter((item) =>
    ["COMPONENT", "SYSTEM"].includes(item.sscType)
    && !electrical.includes(item)
    && !floodSources.includes(item)
    && !fireSources.includes(item));
  const interactionItems = equipment.filter((item) =>
    item.failureModes.some((mode) =>
      mode.failureModeType === "SEISMIC_INTERACTION")
    || /crane|tray/i.test(item.name));

  sfr.thresholdProgram.inherentlyRuggedBases = [
    {
      uuid: `RUGGED-${prefix}-PASSIVE`,
      name: "Passive pressure-boundary and structural configurations",
      referenceGroundMotionParameter: "GMP-SA-1HZ",
      genericRuggedComponentTypes: isSfr
        ? [
            "Welded sodium and water piping with qualified supports",
            "Massive reinforced-concrete structures",
            "Low-pressure passive vessels and baskets",
          ]
        : [
            "Welded helium and water piping with qualified supports",
            "Massive reinforced-concrete structures",
            "Passive spent-fuel vault structures",
          ],
      guidanceReferences: [
        "EPRI NP-6041-SL seismic screening guidance",
        "ASCE/SEI 43 capacity and anchorage acceptance criteria",
        "Project seismic experience-data applicability procedure",
      ],
      plantSpecificAdditions: [{
        componentType: isSfr
          ? "Pool-vessel internals and sodium boundary supports"
          : "Graphite core restraint and reactor-vessel support configurations",
        justification: "Reference-design calculations demonstrate stable load paths, ductile detailing, and capacity beyond the risk-significant hazard range.",
        supportingRefs: isSfr
          ? ["SFR-VESSEL-CAP-021", "SFR-PIPING-SUPPORT-078"]
          : ["HTGR-VESSEL-CAP-014", "HTGR-CORE-RESTRAINT-033"],
      }],
      excludedComponentTypes: [
        "Active electromechanical devices",
        "Relays and contact-sensitive devices",
        "Unanchored or field-modified equipment",
        "Configurations outside the experience-data envelope",
      ],
      capacityBeyondRiskSignificantRangeBasis: "The lower-bound capacity of each accepted configuration exceeds the terminal risk-significant hazard interval after demand, anchorage, support, and interaction checks.",
      hazardIndependentBasis: "Ruggedness is assigned from demonstrated configuration capacity and applicable experience data, independently of the site hazard level.",
      implementsSrs: srs("SFR-C1"),
    },
    {
      uuid: `RUGGED-${prefix}-DISTRIBUTED`,
      name: "Distributed raceway, support, and small-bore piping configurations",
      referenceGroundMotionParameter: "GMP-H-PGA",
      genericRuggedComponentTypes: [
        "Braced cable tray supports within qualified span limits",
        "Small-bore welded piping with lateral restraint",
        "Wall-mounted junction boxes below the project mass limit",
      ],
      guidanceReferences: [
        "SQUG-GIP equipment-class screening tables",
        "Project standard-support qualification matrix",
        "Configuration-control drawing register",
      ],
      plantSpecificAdditions: [{
        componentType: "Standard trapeze and wall-mounted supports",
        justification: "The project standard details bound member size, span, attachment, tributary mass, and installation orientation.",
        supportingRefs: ["STD-SUPPORT-CATALOG-2026", `${prefix}-RACEWAY-SAMPLE-017`],
      }],
      excludedComponentTypes: [
        "Nonstandard transitions",
        "Supports with missing or inaccessible anchors",
        "Cross-division interaction locations",
        "Degraded or field-altered configurations",
      ],
      capacityBeyondRiskSignificantRangeBasis: "Sample calculations and qualification tests bound the standard configurations through the threshold motion; exceptions remain explicit investigation findings.",
      hazardIndependentBasis: "The basis uses configuration limits and qualification capacity rather than a hazard-frequency screen.",
      implementsSrs: srs("SFR-C1"),
    },
    {
      uuid: `RUGGED-${prefix}-STATIONARY`,
      name: "Low-energy stationary passive equipment",
      referenceGroundMotionParameter: "GMP-H-PGA",
      genericRuggedComponentTypes: isSfr
        ? [
            "Guard vessels and passive sodium-retention features",
            "In-vessel storage baskets",
            "Nonpressurized shield and restraint assemblies",
          ]
        : [
            "Dry spent-fuel storage tubes",
            "Passive shielding assemblies",
            "Low-energy stationary tanks with qualified anchorage",
          ],
      guidanceReferences: [
        "Project passive-equipment capacity memorandum",
        "Applicable nuclear seismic experience database",
      ],
      plantSpecificAdditions: [{
        componentType: isSfr
          ? "In-vessel guard and storage assemblies"
          : "Dry-vault storage and passive cooling structures",
        justification: "Geometry, low stored energy, support redundancy, and large deformation margin prevent loss of the credited function within the hazard range.",
        supportingRefs: isSfr
          ? ["SFR-GUARD-VESSEL-042", "SFR-FUEL-BASKET-019"]
          : ["HTGR-DRY-VAULT-026", "HTGR-PASSIVE-COOLING-018"],
      }],
      excludedComponentTypes: [
        "Equipment with active function requirements",
        "Pressure-retaining equipment with unresolved nozzle loads",
        "Equipment capable of spatial interaction",
      ],
      capacityBeyondRiskSignificantRangeBasis: "Bounding static, inertial, and support demands remain below the minimum demonstrated capacity with the project acceptance margin.",
      hazardIndependentBasis: "The classification follows the physical failure resistance and credited function of the configuration.",
      implementsSrs: srs("SFR-C1"),
    },
  ];

  sfr.thresholdProgram.thresholdMethods = [
    {
      uuid: `THRESHOLD-${prefix}-FUNCTIONAL`,
      name: "Equipment functional and anchorage threshold",
      plantResponseThresholdRef: "SPR-SCREEN-EQUIPMENT",
      groundMotionParameterRef: "GMP-SA-1HZ",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      thresholdCapacity: isSfr ? 1.65 : 1.75,
      capacityUnits: "g",
      cumulativeSscCountBasis: screened.filter((item) =>
        ["COMPONENT", "SYSTEM", "CABINET", "PANEL"].includes(item.sscType)).length,
      correlationTreatment: "Common qualification families and co-located equipment are counted as correlated groups; distinct configurations are accumulated independently.",
      screeningCapacitySources: [
        "Plant-specific qualification records",
        "Seismic experience and generic test data",
        "Anchorage and support calculations",
        "Floor-response spectra from Step 08",
      ],
      caveatsAndInclusionRules: [
        "Functional qualification, internal assemblies, anchorage, supports, and connected services must all satisfy the threshold.",
        "Any unresolved interaction or configuration exception remains in the explicit fragility model.",
      ],
      comparisonMethod: "Compare lower-bound component capacity with location-specific median demand and variability, then verify that the cumulative screened contribution remains below the plant-response screening criterion.",
      satisfiesScr2: true,
      implementsSrs: srs("SFR-C2"),
    },
    {
      uuid: `THRESHOLD-${prefix}-PASSIVE`,
      name: "Structural and passive SSC threshold",
      plantResponseThresholdRef: "SPR-SCREEN-PASSIVE",
      groundMotionParameterRef: "GMP-SA-1HZ",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      thresholdCapacity: isSfr ? 1.9 : 2.05,
      capacityUnits: "g",
      cumulativeSscCountBasis: screened.filter((item) =>
        ["STRUCTURE", "OTHER"].includes(item.sscType)).length,
      correlationTreatment: "Common structural response and shared support paths are preserved as correlated demand; configuration-specific capacities remain separate.",
      screeningCapacitySources: [
        "Nonlinear structural capacity calculations",
        "Standard support qualification catalog",
        "Applicable seismic experience data",
      ],
      caveatsAndInclusionRules: [
        "All credible structural, pressure-boundary, clearance, and differential-displacement mechanisms are included.",
        "Spatial interaction checks must be closed before final screening.",
      ],
      comparisonMethod: "Demonstrate that the lower-tail capacity exceeds the risk-significant response range and that aggregate conditional failure remains below the screening criterion.",
      satisfiesScr2: true,
      implementsSrs: srs("SFR-C2"),
    },
    {
      uuid: `THRESHOLD-${prefix}-RELAY`,
      name: "Relay and contact-chatter threshold",
      plantResponseThresholdRef: "SPR-SCREEN-RELAY",
      groundMotionParameterRef: "GMP-H-SA-10HZ",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      thresholdCapacity: isSfr ? 2.4 : 2.55,
      capacityUnits: "g",
      cumulativeSscCountBasis: equipment.filter((item) =>
        item.sscType === "RELAY").length,
      correlationTreatment: "Identical relay model, mounting, orientation, and cabinet location are treated as one perfectly correlated population.",
      screeningCapacitySources: [
        "Plant-specific chatter test spectra",
        "Cabinet amplification calculations",
        "Relay mounting and restraint inspection",
      ],
      caveatsAndInclusionRules: [
        "Both spurious actuation and failure-to-actuate contacts are evaluated.",
        "A relay outside the tested model, orientation, or frequency envelope is not screened.",
      ],
      comparisonMethod: "Compare cabinet in-structure response spectra with the qualified chatter spectrum at each sensitive frequency and retain the lowest margin.",
      higherSeismicityAdjustment: "Apply the project high-frequency amplification factor when the cabinet resonance lies above 15 Hz.",
      satisfiesScr2: true,
      implementsSrs: srs("SFR-C2"),
    },
    {
      uuid: `THRESHOLD-${prefix}-SOURCE`,
      name: "Flood and fire source boundary threshold",
      plantResponseThresholdRef: "SPR-SCREEN-SOURCE",
      groundMotionParameterRef: "GMP-H-PGA",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      thresholdCapacity: isSfr ? 1.35 : 1.45,
      capacityUnits: "g",
      cumulativeSscCountBasis: floodSources.length + fireSources.length,
      correlationTreatment: "Sources sharing a support, room response, or common header are grouped; separated sources are accumulated independently.",
      screeningCapacitySources: [
        "Pipe, tank, cabinet, and transformer anchorage calculations",
        "Internal flooding and fire source inventories",
        "Seismic interaction investigation findings",
      ],
      caveatsAndInclusionRules: [
        "Boundary, support, spray, drainage, ignition, and propagation consequences are included.",
        "Screening does not remove the source from the fire or flood interface inventory.",
      ],
      comparisonMethod: "Compare source boundary and support capacity with local demand, then confirm that downstream flood or fire consequences remain bounded.",
      satisfiesScr2: true,
      implementsSrs: srs("SFR-C2"),
    },
  ];
  sfr.thresholdProgram.screenedSscRefs = screened.map((item) => item.uuid);
  sfr.thresholdProgram.screeningConfirmationMethod = "Each non-active SEL disposition is matched to an applicable ruggedness or threshold basis, then confirmed against configuration, anchorage, supports, connected services, credible interactions, and location-specific response. Exceptions are retained as findings or explicit fragilities.";
  sfr.thresholdProgram.anchorageAndSupportIncluded = true;
  sfr.thresholdProgram.implementsSrs = srs("SFR-C1", "SFR-C2");

  const primary = active[0] ?? equipment[0]!;
  const secondary = active[1] ?? equipment[1] ?? primary;
  const firstRelay = equipment.find((item) => item.sscType === "RELAY")
    ?? electrical[0] ?? primary;
  const firstCabinet = equipment.find((item) =>
    item.sscType === "CABINET" || item.sscType === "PANEL")
    ?? electrical[0] ?? primary;
  const firstPipe = equipment.find((item) =>
    /piping|header|duct/i.test(item.name)) ?? mechanical[0] ?? primary;
  const crane = equipment.find((item) => /crane/i.test(item.name))
    ?? interactionItems[0] ?? primary;
  const cableTray = equipment.find((item) => /tray/i.test(item.name))
    ?? interactionItems.at(-1) ?? primary;
  const battery = equipment.find((item) => /battery rack/i.test(item.name))
    ?? electrical[0] ?? primary;

  const integrationFindings: Finding[] = [
    finding(
      "FINDING-1",
      "Connected-service differential displacement",
      primary,
      "INTERACTION",
      isSfr
        ? "Differential motion between the pump deck and connected sodium service line can impose a nozzle load not represented by equipment inertia alone."
        : "Differential motion between the circulator support and connected helium service line can impose casing and nozzle loads not represented by equipment inertia alone.",
      `Preserve ${primary.creditedFunctions[0] ?? "the credited equipment function"} following the earthquake.`,
      "Retain the connected-line demand in the controlling plant-specific fragility and track support configuration during final design closure.",
      [`${prefix}-INTERACTION-CALC-001`, `${prefix}-PIPING-STRESS-044`],
      true,
    ),
    finding(
      `FINDING-${prefix}-RELAY`,
      "Relay contact-chatter envelope",
      firstRelay,
      "INTERNAL_ASSEMBLY",
      "The cabinet structure is adequate, but the relay contact response must be evaluated against the amplified cabinet spectrum and qualified orientation.",
      firstRelay.creditedFunctions[0] ?? "Maintain the credited trip and protection logic.",
      "Use the plant-specific chatter threshold; retain any unmatched relay model or mounting as an explicit contact-chatter fragility.",
      [`${prefix}-RELAY-TEST-011`, `${prefix}-CABINET-FRS-006`],
      true,
    ),
    finding(
      `FINDING-${prefix}-CABINET`,
      "Cabinet internal-module restraint",
      firstCabinet,
      "INTERNAL_ASSEMBLY",
      "Cable bundles and plug-in modules require positive restraint confirmation independent of cabinet frame and floor anchorage capacity.",
      firstCabinet.creditedFunctions[0] ?? "Maintain the credited cabinet function.",
      "Add restraint verification to the installation acceptance record and include internal-module capacity in the screening comparison.",
      [`${prefix}-CABINET-DETAIL-128`, `${prefix}-INSTALL-ITP-031`],
    ),
    finding(
      `FINDING-${prefix}-PIPE`,
      "Supported line displacement compatibility",
      firstPipe,
      "DIFFERENTIAL_DISPLACEMENT",
      "The line crosses response locations with different structural motion; support gaps and branch flexibility control the pressure-boundary check.",
      firstPipe.creditedFunctions[0] ?? "Maintain the credited fluid boundary.",
      "Use correlated support motions in the piping calculation and retain the bounding branch or nozzle mechanism.",
      [`${prefix}-PIPING-STRESS-052`, `${prefix}-SUPPORT-GAP-LOG-009`],
      true,
    ),
    finding(
      `FINDING-${prefix}-CRANE`,
      "Parked crane falling-hazard control",
      crane,
      "FALLING_HAZARD",
      "Loss of a parking restraint or trolley travel could create a falling or impact hazard over credited SSCs.",
      "Prevent impact on credited equipment and preserve the protected access route.",
      "Credit verified rail clips, end stops, parking restraints, and a controlled no-load parked configuration; otherwise retain an interaction fragility.",
      [`${prefix}-CRANE-RESTRAINT-017`, `${prefix}-HEAVY-LOAD-CTRL-004`],
      true,
    ),
    finding(
      `FINDING-${prefix}-TRAY`,
      "Cable-tray separation exception",
      cableTray,
      "CLEARANCE",
      "A nonstandard tray transition has less clearance than the qualified configuration and could contact the redundant division or obstruct access.",
      cableTray.creditedFunctions[0] ?? "Preserve separated electrical divisions and operator access.",
      "Resolve the transition before final walkdown or retain a localized interaction failure in the plant response model.",
      [`${prefix}-RACEWAY-SAMPLE-017`, `${prefix}-INTERACTION-REGISTER-008`],
      true,
    ),
    finding(
      `FINDING-${prefix}-BATTERY`,
      "Battery-rack installation tolerance",
      battery,
      "MAINTENANCE_CONDITION",
      "Required cell spacers, terminal slack, and anchor torque must remain within the qualified installation envelope.",
      battery.creditedFunctions[0] ?? "Preserve the credited DC power function.",
      "Add spacer, jumper, and anchor-torque checks to installation acceptance and periodic seismic configuration control.",
      [`${prefix}-BATTERY-QUAL-023`, `${prefix}-ANCHOR-TORQUE-ITP-012`],
    ),
  ];

  const sourceFindings: Finding[] = [
    ...floodSources.map((item, index) => finding(
      `FINDING-${prefix}-FLOOD-${index + 1}`,
      `${item.name} boundary and spray check`,
      item,
      "FLOOD_SOURCE",
      "Seismic rupture, support failure, connected-line motion, and the resulting spray or accumulation path were evaluated at the installed location.",
      item.creditedFunctions[0] ?? "Maintain the source boundary and prevent loss of credited equipment.",
      "Confirm supports, isolation, spray protection, drainage, and affected equipment against the internal-flood interface; retain a fragility if the boundary threshold is not met.",
      [`${prefix}-FLOOD-SOURCE-${String(index + 1).padStart(2, "0")}`, "IF-SEISMIC-SOURCE-REVIEW"],
      true,
    )),
    ...fireSources.map((item, index) => finding(
      `FINDING-${prefix}-FIRE-${index + 1}`,
      `${item.name} ignition and propagation check`,
      item,
      "FIRE_SOURCE",
      "Seismic anchorage, internal fault or spill potential, ignition, separation, and propagation to credited targets were evaluated.",
      item.creditedFunctions[0] ?? "Prevent a seismically induced fire from disabling credited equipment.",
      "Confirm source restraint, electrical or fluid boundary qualification, separation, barriers, and suppression coverage; retain an ignition-source fragility if screening is not demonstrated.",
      [`${prefix}-FIRE-SOURCE-${String(index + 1).padStart(2, "0")}`, "FIRE-SEISMIC-SOURCE-REVIEW"],
      true,
    )),
  ];

  const standardTeam = team(`INV-${prefix}-DESIGN`, [
    {
      name: "Lead seismic capability engineer",
      role: "Investigation lead",
      seismic: "Twenty years of nuclear seismic capability, fragility, and anchorage evaluation.",
      walkdown: "Qualified lead for nuclear seismic walkdowns and interaction reviews.",
      systems: "Led systems-fragility reconciliation for the reference design.",
      qualifications: ["Civil/structural PE", "Seismic walkdown lead", "Fragility analyst"],
    },
    {
      name: "Mechanical systems engineer",
      role: "Mechanical and piping reviewer",
      seismic: "Seismic qualification of pumps, vessels, piping, and supports.",
      walkdown: "Mechanical equipment and piping walkdown team member.",
      systems: "Responsible for credited heat-transport and decay-heat-removal functions.",
      qualifications: ["Mechanical PE", "Piping stress analyst"],
    },
    {
      name: "Electrical and I&C engineer",
      role: "Electrical functional reviewer",
      seismic: "Qualification of cabinets, relays, batteries, switchgear, and internal assemblies.",
      walkdown: "Electrical equipment and raceway inspection experience.",
      systems: "Protection, DC, and AC distribution model owner.",
      qualifications: ["Electrical PE", "Relay chatter qualification reviewer"],
    },
    {
      name: "Operations and human-factors specialist",
      role: "Access and action reviewer",
      seismic: "Post-earthquake action feasibility and control-room habitability review.",
      walkdown: "Operator-access and interaction walkdowns.",
      systems: "Licensed-operator training and emergency operating procedure development.",
      qualifications: ["Senior reactor operator experience", "Human reliability analyst"],
    },
  ]);

  const confirmations = (items: Equipment[]): Investigation["fragilityThresholdConfirmations"] =>
    items
      .filter((item) => screened.some((screenedItem) =>
        screenedItem.uuid === item.uuid))
      .map((item) => ({
        sscRef: item.uuid,
        anchorageConfirmed: true,
        supportConfirmed: true,
        thresholdSatisfied: true,
        basis: item.disposition === "INHERENTLY_RUGGED"
          ? "Configuration and credited function match the applicable inherently rugged basis; identified exceptions are tracked separately."
          : "Location-specific demand, functional or structural capacity, anchorage, supports, and interactions satisfy the applicable cumulative threshold method.",
      }));

  const mechanicalScope = unique([...mechanical, primary, secondary]);
  const structuralScope = unique(passive);
  const electricalScope = unique(electrical);
  const sourceScope = unique([...floodSources, ...fireSources]);
  const interactionScope = unique([...interactionItems, primary, firstPipe]);

  sfr.plantInvestigations = [
    {
      uuid: `INVESTIGATION-${prefix}-INTEGRATED`,
      name: "Integrated seismic configuration investigation",
      investigationType: "COMPUTERIZED_WALKDOWN",
      conditionBasis: "AS_INTENDED_TO_OPERATE",
      date: "2026-04-16",
      scope: `All ${equipment.length} SEL records, modeled locations, support paths, adjacent hazards, and post-earthquake access routes for the ${isSfr ? "SFR" : "HTGR"} reference design.`,
      procedures: "Review the controlled three-dimensional plant model, equipment data sheets, arrangement drawings, qualification records, and systems model; trace each credited function from equipment through support and structural response location.",
      team: standardTeam,
      designDocumentRefs: [
        `${prefix}-3D-MODEL-2026-R2`,
        `${prefix}-GENERAL-ARRANGEMENT-2026`,
        `${prefix}-SEL-REV-04`,
        `${prefix}-SEISMIC-IPE-001`,
      ],
      sscRefsReviewed: equipment.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Each SSC was traced from equipment anchorage or restraint through supports, floor or wall attachment, structural model, foundation, and site-response input; connected services and differential motion were included.",
      observations: [
        "Response location and orientation are assigned to every SEL record.",
        "Standard configurations are distinguished from exceptions requiring a finding.",
        "Spatial interactions and protected access routes are represented in the plant model.",
      ],
      findings: integrationFindings,
      fragilityThresholdConfirmations: [],
      conclusions: "The intended design supports the Step 08 SEL and response mapping. Risk-significant exceptions remain explicit findings and are transferred to fragility or plant-response treatment.",
      limitations: [
        "Final as-built dimensions, anchor installation, support gaps, and housekeeping conditions require field confirmation before operation.",
      ],
      implementsSrs: srs("SFR-D2", "SFR-D4", "SFR-D5", "SFR-D8"),
    },
    {
      uuid: `INVESTIGATION-${prefix}-STRUCTURAL`,
      name: "Structural, anchorage, and support-path review",
      investigationType: "DESIGN_DOCUMENT_REVIEW",
      conditionBasis: "AS_DESIGNED",
      date: "2026-04-22",
      scope: `${structuralScope.length} structural and passive SEL records, including complete equipment-to-foundation load paths and credible differential movement.`,
      procedures: "Reconcile structural calculations, anchor schedules, support details, equipment loads, response locations, construction tolerances, and standard-detail applicability.",
      team: standardTeam.slice(0, 2),
      designDocumentRefs: [
        `${prefix}-STRUCT-CALC-INDEX-2026`,
        `${prefix}-ANCHORAGE-SCHEDULE-REV3`,
        `${prefix}-STANDARD-SUPPORT-CATALOG`,
      ],
      sscRefsReviewed: structuralScope.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Anchor group, baseplate, weld, support member, embedment, diaphragm, wall or floor, and foundation links were checked with the applicable failure modes.",
      observations: [
        "Standard support details remain within their qualified mass and span envelopes.",
        "Shared structures preserve correlated demand in the screening comparison.",
        "Nonstandard transitions remain configuration-controlled exceptions.",
      ],
      findings: [],
      fragilityThresholdConfirmations: confirmations(structuralScope),
      conclusions: "Structural and passive screened dispositions satisfy the defined ruggedness or cumulative threshold basis with anchorage and supports included.",
      limitations: ["Concrete anchor installation records and final field modifications remain pre-operational closure evidence."],
      implementsSrs: srs("SFR-D1", "SFR-D2", "SFR-D4", "SFR-D5"),
    },
    {
      uuid: `INVESTIGATION-${prefix}-MECHANICAL`,
      name: "Mechanical equipment and connected-services review",
      investigationType: "TABLETOP_REVIEW",
      conditionBasis: "AS_INTENDED_TO_OPERATE",
      date: "2026-04-28",
      scope: `${mechanicalScope.length} mechanical SSCs and their functional qualification, internal assemblies, supports, nozzles, piping, and operating configuration.`,
      procedures: "Reconcile equipment qualification, vendor data, piping stress results, support drawings, required operating state, isolation capability, and credited system function.",
      team: [standardTeam[0]!, standardTeam[1]!, standardTeam[3]!],
      designDocumentRefs: [
        `${prefix}-MECH-EQUIPMENT-QUAL-INDEX`,
        `${prefix}-PIPING-STRESS-INDEX`,
        `${prefix}-SYSTEM-DESCRIPTIONS-REV2`,
      ],
      sscRefsReviewed: mechanicalScope.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Equipment feet, hold-downs, internal supports, vessel or skid supports, connected piping, nozzles, and structural attachment were evaluated as one functional load path.",
      observations: [
        "Active primary and secondary SSCs remain in explicit fragility analysis.",
        "Connected-service loads are combined with inertial and support demands.",
        "Screened redundant or passive mechanical items meet their applicable configuration limits.",
      ],
      findings: [],
      fragilityThresholdConfirmations: confirmations(mechanicalScope),
      conclusions: "Mechanical threshold dispositions are supported by functional capacity, support, and connected-service evidence; active items remain explicitly modeled.",
      limitations: ["Vendor final certified data and installed flexible-connection geometry require configuration closeout."],
      implementsSrs: srs("SFR-D1", "SFR-D2", "SFR-D4", "SFR-D5"),
    },
    {
      uuid: `INVESTIGATION-${prefix}-ELECTRICAL`,
      name: "Electrical, I&C, and relay functional review",
      investigationType: "DESIGN_DOCUMENT_REVIEW",
      conditionBasis: "AS_DESIGNED",
      date: "2026-05-05",
      scope: `${electricalScope.length} electrical and I&C SEL records, including cabinets, relays, internal modules, battery racks, switchgear, and raceways.`,
      procedures: "Compare component and cabinet test spectra with in-structure response; verify model, orientation, mounting, internal restraint, anchorage, cable interfaces, chatter contacts, and credited logic.",
      team: [standardTeam[0]!, standardTeam[2]!, standardTeam[3]!],
      designDocumentRefs: [
        `${prefix}-EQ-QUAL-MASTER-LIST`,
        `${prefix}-RELAY-CHATTER-EVAL-011`,
        `${prefix}-DC-POWER-CALC-044`,
        `${prefix}-CABLE-ROUTING-REV5`,
      ],
      sscRefsReviewed: electricalScope.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Cabinet and rack anchors, lineup connections, internal subassemblies, mounted devices, cable slack, raceway supports, and structural attachment were checked.",
      observations: [
        "Relay functional screening uses cabinet-amplified demand rather than building PGA alone.",
        "Battery-rack qualification includes cell and intercell connection response.",
        "Internal-module restraint is an explicit installation acceptance attribute.",
      ],
      findings: [],
      fragilityThresholdConfirmations: confirmations(electricalScope),
      conclusions: "Electrical and I&C screened dispositions meet the applicable functional, anchorage, and chatter thresholds subject to documented installation controls.",
      limitations: ["Final relay bill of material, cabinet internal arrangement, and cable dress require as-built confirmation."],
      implementsSrs: srs("SFR-D1", "SFR-D2", "SFR-D4", "SFR-D5"),
    },
    {
      uuid: `INVESTIGATION-${prefix}-SOURCES`,
      name: "Seismically induced flood and fire source review",
      investigationType: "TABLETOP_REVIEW",
      conditionBasis: "AS_INTENDED_TO_OPERATE",
      date: "2026-05-12",
      scope: `${floodSources.length} internal-flood and ${fireSources.length} internal-fire source records, including boundary failure, support, spray, drainage, ignition, propagation, separation, and target impacts.`,
      procedures: "Reconcile SEL source records with internal-flood and internal-fire inventories; assess seismic failure modes, local response, source magnitude, isolation, drainage, barriers, suppression, and affected credited SSCs.",
      team: standardTeam,
      designDocumentRefs: [
        `${prefix}-INTERNAL-FLOOD-INTERFACE-REV2`,
        `${prefix}-INTERNAL-FIRE-INTERFACE-REV2`,
        `${prefix}-HAZARD-BARRIER-DRAWINGS`,
      ],
      sscRefsReviewed: sourceScope.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Source vessel, piping, cabinet, or transformer restraint and the complete support path were checked together with connected lines and potential impact hazards.",
      observations: [
        "Spray and accumulation paths are traced to credited electrical and mechanical targets.",
        "Ignition and propagation assessments preserve credited separation and barriers.",
        "A threshold disposition does not remove a source from downstream fire or flood interfaces.",
      ],
      findings: sourceFindings,
      fragilityThresholdConfirmations: confirmations(sourceScope),
      conclusions: "All identified seismic flood and fire sources have a plant-specific failure and consequence disposition; unresolved source behavior would remain explicitly modeled.",
      limitations: ["Final room penetrations, drains, combustible loading, and suppression configuration require as-built confirmation."],
      implementsSrs: srs("SFR-D1", "SFR-D2", "SFR-D4", "SFR-D5", "SFR-D6", "SFR-D7"),
    },
    {
      uuid: `INVESTIGATION-${prefix}-INTERACTIONS`,
      name: "Spatial interaction and operator-access review",
      investigationType: "WALKDOWN",
      conditionBasis: "AS_INTENDED_TO_OPERATE",
      date: "2026-05-19",
      scope: `${interactionScope.length} potential interaction sources plus credited equipment, access routes, temporary loads, and post-earthquake action locations.`,
      procedures: "Apply the seismic interaction checklist to falling, impact, differential displacement, spray, fire, clearance, temporary-load, and access-route conditions using the controlled design model and planned operating configuration.",
      team: [standardTeam[0]!, standardTeam[1]!, standardTeam[2]!, standardTeam[3]!],
      designDocumentRefs: [
        `${prefix}-INTERACTION-REGISTER-REV3`,
        `${prefix}-OPERATOR-ACCESS-ROUTES`,
        `${prefix}-HOUSEKEEPING-CONTROL-PROGRAM`,
      ],
      sscRefsReviewed: interactionScope.map((item) => item.uuid),
      anchorageAndLoadPathReview: "Potential interaction sources were checked for restraint and movement; protected targets and access routes were checked for clearance across the full displacement envelope.",
      observations: [
        "Heavy loads are controlled in verified parked configurations.",
        "Cross-division raceway and piping transitions receive focused closure checks.",
        "Operator travel and local action stations remain accessible after design-basis displacement.",
      ],
      findings: [],
      fragilityThresholdConfirmations: confirmations(interactionScope),
      conclusions: "Credible interaction mechanisms are either resolved by controlled design features or retained as findings linked to fragility and plant-response treatment.",
      limitations: ["Temporary loads, maintenance staging, final labels, and route obstructions require confirmation during the physical pre-operational walkdown."],
      implementsSrs: srs("SFR-D2", "SFR-D4", "SFR-D5", "SFR-D8"),
    },
  ];

  const confirmed = new Set(
    sfr.plantInvestigations.flatMap((investigation) =>
      investigation.fragilityThresholdConfirmations.map((confirmation) =>
        confirmation.sscRef)),
  );
  const missing = screened.filter((item) => !confirmed.has(item.uuid));
  if (missing.length > 0) {
    sfr.plantInvestigations[1]!.sscRefsReviewed.push(
      ...missing.map((item) => item.uuid),
    );
    sfr.plantInvestigations[1]!.fragilityThresholdConfirmations.push(
      ...confirmations(missing),
    );
  }

  if (reactorBuilding.length > 0) {
    sfr.plantInvestigations[0]!.observations.push(
      `${reactorBuilding} structural response locations are reconciled with the investigated equipment elevations and support paths.`,
    );
  }
}
