import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference } from "interfaces-mef-types/core/pra-common";
import {
  type SeismicEquipmentListEntry,
  type SeismicEquipmentListInclusionSource,
  type SeismicFailureModeType,
} from "interfaces-mef-types/seismic/seismic-pra-common";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type SscType = SeismicEquipmentListEntry["sscType"];
type Disposition = SeismicEquipmentListEntry["disposition"];
type RequiredState =
  SeismicEquipmentListEntry["failureModes"][number]["requiredState"];
type ResponseAnalysis =
  SeismicPRA["seismicFragilityAnalysis"]["seismicResponseAnalysis"];
type StructuralModel = ResponseAnalysis["structuralModels"][number];

interface EquipmentTemplate {
  id: string;
  name: string;
  sscType: SscType;
  building: string;
  room: string;
  elevation: string;
  function: string;
  failureName: string;
  failureType: SeismicFailureModeType;
  requiredState: RequiredState;
  consequence: string;
  inclusionSources: SeismicEquipmentListInclusionSource[];
  disposition: Disposition;
  dispositionBasis: string;
  mounting: string;
  systemRef?: string;
  structureRef?: string;
  orientation?: string;
  responseModel: "RB" | "SUPPORT" | "DHR" | "CONTROL";
}

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function equipmentTemplates(
  kind: ReactorKind,
  reactorBuilding: string,
): EquipmentTemplate[] {
  if (kind === "sfr") {
    return [
      {
        id: "PRIMARY",
        name: "Primary sodium pump P-1",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Primary equipment bay",
        elevation: "812.0 m",
        function: "Maintain primary sodium circulation or provide credited coastdown",
        failureName: "Loss of primary sodium pump P-1 credited function",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Challenges core heat transport and increases demand on passive decay-heat removal.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ACTIVE",
        dispositionBasis: "Explicitly modeled because pump coastdown and functional capacity are risk-significant.",
        mounting: "Vertical pump supported from the reactor-vessel deck with qualified hold-downs and lateral guides.",
        systemRef: "SYSTEM-PRIMARY-HEAT-TRANSPORT",
        orientation: "Vertical shaft; plant X-Y lateral demand",
        responseModel: "RB",
      },
      {
        id: "SECONDARY",
        name: "Decay heat removal air cooler AC-1",
        sscType: "SYSTEM",
        building: "Decay-heat-removal structure",
        room: "Air-cooler deck",
        elevation: "827.5 m",
        function: "Reject decay heat to the atmosphere following loss of normal heat transport",
        failureName: "Loss of decay heat removal air cooler AC-1",
        failureType: "SOIL_FAILURE",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Removes a credited passive decay-heat-removal train and drives the leading damage sequence.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SECONDARY_HAZARD", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ACTIVE",
        dispositionBasis: "Retained because localized ground deformation and support response control risk.",
        mounting: "Steel air-cooler frame on a shallow mat with flexible buried sodium piping connections.",
        systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
        orientation: "Long axis plant X",
        responseModel: "DHR",
      },
      {
        id: "REACTOR-BUILDING",
        name: "Reactor building seismic load path",
        sscType: "STRUCTURE",
        building: reactorBuilding,
        room: "Basemat through roof",
        elevation: "798.0-842.0 m",
        function: "Support and protect safety-significant reactor and heat-transport SSCs",
        failureName: "Reactor building excessive drift or structural yielding",
        failureType: "STRUCTURAL",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Common structural failure can disable multiple heat-removal and shutdown functions.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Nonlinear structural capacity exceeds the cumulative screening threshold with margin.",
        mounting: "Embedded reinforced-concrete shear-wall structure on a common basemat.",
        structureRef: "STRUCTURE-REACTOR-BUILDING",
        responseModel: "RB",
      },
      {
        id: "REACTOR-VESSEL",
        name: "Reactor vessel and support skirt",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Reactor cavity",
        elevation: "804.5 m",
        function: "Maintain primary sodium inventory, core geometry, and support alignment",
        failureName: "Reactor vessel support or pressure-boundary failure",
        failureType: "PRESSURE_BOUNDARY",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Loss of vessel integrity or support alignment challenges all core-cooling paths.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Vessel support and shell capacity exceed the threshold; detailed load combinations remain controlled.",
        mounting: "Top-supported vessel with circumferential support skirt and radial seismic restraints.",
        systemRef: "SYSTEM-REACTOR-VESSEL",
        orientation: "Axisymmetric with direction-specific support demands",
        responseModel: "RB",
      },
      {
        id: "GUARD-VESSEL",
        name: "Guard vessel",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Reactor cavity",
        elevation: "803.0 m",
        function: "Retain leaked primary sodium at a level that preserves core cooling",
        failureName: "Guard-vessel pressure-boundary failure",
        failureType: "PRESSURE_BOUNDARY",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "A coincident vessel and guard-vessel failure can uncover primary heat-transport components.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC"],
        disposition: "INHERENTLY_RUGGED",
        dispositionBasis: "Welded low-pressure shell and continuous support exhibit capacity beyond the risk-significant range.",
        mounting: "Continuously supported welded steel vessel surrounding the reactor vessel.",
        systemRef: "SYSTEM-REACTOR-VESSEL",
        responseModel: "RB",
      },
      {
        id: "PRIMARY-PUMP-P2",
        name: "Primary sodium pump P-2",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Primary equipment bay",
        elevation: "812.0 m",
        function: "Maintain the redundant primary circulation path or provide coastdown",
        failureName: "Loss of primary sodium pump P-2 credited function",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Increases dependency on the remaining primary pump and passive heat removal.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Qualified pump and support capacity exceed the cumulative threshold.",
        mounting: "Top-supported vertical pump with qualified lateral restraints.",
        systemRef: "SYSTEM-PRIMARY-HEAT-TRANSPORT",
        responseModel: "RB",
      },
      {
        id: "IHX-A",
        name: "Intermediate heat exchanger IHX-A",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Primary equipment bay",
        elevation: "810.5 m",
        function: "Transfer heat from primary to intermediate sodium without loss of boundary",
        failureName: "IHX-A support or pressure-boundary failure",
        failureType: "PRESSURE_BOUNDARY",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Disables a heat-transport train and may initiate a sodium release.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Shell, nozzle, and support loads remain below screened capacities over the hazard range.",
        mounting: "Top-supported vertical vessel with lateral keys at the support deck.",
        systemRef: "SYSTEM-INTERMEDIATE-HEAT-TRANSPORT",
        responseModel: "RB",
      },
      {
        id: "IHX-B",
        name: "Intermediate heat exchanger IHX-B",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Primary equipment bay",
        elevation: "810.5 m",
        function: "Transfer heat through the redundant intermediate sodium train",
        failureName: "IHX-B support or pressure-boundary failure",
        failureType: "PRESSURE_BOUNDARY",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Removes the redundant intermediate heat-transport train.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Common design is screened with train-specific response and anchorage checks.",
        mounting: "Top-supported vertical vessel with lateral keys at the support deck.",
        systemRef: "SYSTEM-INTERMEDIATE-HEAT-TRANSPORT",
        responseModel: "RB",
      },
      {
        id: "DRACS-HX",
        name: "Direct reactor auxiliary cooling heat exchanger",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Reactor cavity upper gallery",
        elevation: "821.0 m",
        function: "Transfer decay heat from the reactor pool to the passive air path",
        failureName: "DRACS heat-exchanger support or functional failure",
        failureType: "ANCHORAGE",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Degrades passive decay-heat-removal capability.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Support, nozzle, and tube-bundle capacities exceed the threshold.",
        mounting: "Braced steel support frame anchored to the reactor-building wall.",
        systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
        responseModel: "RB",
      },
      {
        id: "DHR-DAMPER",
        name: "Decay-heat-removal air-path isolation damper",
        sscType: "COMPONENT",
        building: "Decay-heat-removal structure",
        room: "Air inlet plenum",
        elevation: "823.0 m",
        function: "Fail open and preserve the natural-draft air path",
        failureName: "Damper fails to open after seismic demand",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Blocks natural draft for one decay-heat-removal train.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Fail-open mechanism and low-mass blade assembly pass qualification screening.",
        mounting: "Flanged duct section with independent frame anchorage.",
        systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
        responseModel: "DHR",
      },
      {
        id: "CRDM-1",
        name: "Primary shutdown rod drive mechanisms",
        sscType: "SYSTEM",
        building: reactorBuilding,
        room: "Reactor head service level",
        elevation: "829.0 m",
        function: "Insert primary shutdown rods on trip",
        failureName: "Failure to insert shutdown rods",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_DURING_EARTHQUAKE",
        consequence: "Prevents prompt reactor shutdown and changes the initiating-event sequence.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Drop testing and structural support calculations demonstrate capacity above threshold.",
        mounting: "Drive housings bolted to the reactor head support structure.",
        systemRef: "SYSTEM-REACTOR-SHUTDOWN",
        responseModel: "RB",
      },
      {
        id: "CRDM-2",
        name: "Diverse shutdown rod drive mechanisms",
        sscType: "SYSTEM",
        building: reactorBuilding,
        room: "Reactor head service level",
        elevation: "829.0 m",
        function: "Insert the diverse shutdown rods following a seismic trip",
        failureName: "Failure of diverse shutdown rod insertion",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_DURING_EARTHQUAKE",
        consequence: "Eliminates the diverse shutdown path if the primary system also fails.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Mechanically diverse drive train is qualified above the cumulative threshold.",
        mounting: "Independent head-mounted drive supports with lateral bracing.",
        systemRef: "SYSTEM-DIVERSE-SHUTDOWN",
        responseModel: "RB",
      },
      {
        id: "RTS-CABINET",
        name: "Reactor trip system cabinet A",
        sscType: "CABINET",
        building: "Control and electrical building",
        room: "Protection system room",
        elevation: "808.0 m",
        function: "Generate and distribute reactor trip signals",
        failureName: "Trip cabinet loss of function",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_DURING_EARTHQUAKE",
        consequence: "Can prevent automatic shutdown or spuriously actuate protection logic.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Cabinet anchorage and internal module qualification exceed the threshold.",
        mounting: "Four-point floor anchorage with top bracing and qualified internal subassemblies.",
        systemRef: "SYSTEM-REACTOR-PROTECTION",
        responseModel: "CONTROL",
      },
      {
        id: "RTS-RELAY",
        name: "Undervoltage relay train A",
        sscType: "RELAY",
        building: "Control and electrical building",
        room: "Protection system room",
        elevation: "808.0 m",
        function: "Initiate protective logic on loss of bus voltage",
        failureName: "Relay contact chatter causes spurious or failed actuation",
        failureType: "CONTACT_CHATTER",
        requiredState: "FUNCTION_DURING_EARTHQUAKE",
        consequence: "Can defeat a protection channel or spuriously challenge support systems.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Plant-specific chatter qualification exceeds the screening motion.",
        mounting: "Panel-mounted relay with qualified socket and restraint clip.",
        systemRef: "SYSTEM-ELECTRICAL-PROTECTION",
        responseModel: "CONTROL",
      },
      {
        id: "DC-BATTERY-A",
        name: "Class 1E DC battery rack A",
        sscType: "COMPONENT",
        building: "Control and electrical building",
        room: "Battery room A",
        elevation: "804.0 m",
        function: "Supply uninterrupted DC power to protection and control loads",
        failureName: "Battery rack anchorage or cell-connection failure",
        failureType: "ANCHORAGE",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Disables one DC division and associated trip, indication, and valve loads.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Rack anchorage and intercell connection tests exceed the threshold.",
        mounting: "Two-tier restrained rack with embedded anchors and cell spacers.",
        systemRef: "SYSTEM-DC-POWER",
        responseModel: "CONTROL",
      },
      {
        id: "DC-BATTERY-B",
        name: "Class 1E DC battery rack B",
        sscType: "COMPONENT",
        building: "Control and electrical building",
        room: "Battery room B",
        elevation: "804.0 m",
        function: "Supply the redundant DC protection and control division",
        failureName: "Battery rack B anchorage or connection failure",
        failureType: "ANCHORAGE",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Removes the redundant DC division.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Common qualification is confirmed against train-specific floor response.",
        mounting: "Two-tier restrained rack with embedded anchors and cell spacers.",
        systemRef: "SYSTEM-DC-POWER",
        responseModel: "CONTROL",
      },
      {
        id: "SWITCHGEAR",
        name: "Safety-related 4.16 kV switchgear",
        sscType: "CABINET",
        building: "Control and electrical building",
        room: "Medium-voltage switchgear room",
        elevation: "804.0 m",
        function: "Distribute AC power to credited heat-removal and support loads",
        failureName: "Switchgear functional or anchorage failure",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Causes a loss of powered support functions and may initiate station blackout logic.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Cabinet-lineup anchorage, bus bracing, and breaker qualification exceed threshold.",
        mounting: "Multi-bay lineup anchored to a housekeeping pad with inter-bay bolting.",
        systemRef: "SYSTEM-AC-POWER",
        responseModel: "CONTROL",
      },
      {
        id: "SODIUM-PIPING",
        name: "Intermediate sodium piping loop A",
        sscType: "FIRE_SOURCE",
        building: "Steam-generator and sodium-service building",
        room: "Intermediate sodium gallery",
        elevation: "813.0 m",
        function: "Maintain the intermediate sodium pressure boundary",
        failureName: "Seismic sodium leak and ignition",
        failureType: "FIRE_IGNITION_SOURCE",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Produces a sodium fire that can challenge redundant heat-transport equipment and access.",
        inclusionSources: ["INTERNAL_FIRE_IGNITION_SOURCE", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Welded piping and supports are screened; interaction clearances are tracked.",
        mounting: "Welded piping with variable and constant spring supports plus seismic restraints.",
        systemRef: "SYSTEM-INTERMEDIATE-HEAT-TRANSPORT",
        responseModel: "SUPPORT",
      },
      {
        id: "SODIUM-STORAGE",
        name: "Intermediate sodium drain tank",
        sscType: "FIRE_SOURCE",
        building: "Steam-generator and sodium-service building",
        room: "Sodium service cell",
        elevation: "802.5 m",
        function: "Retain drained sodium inventory during normal and accident conditions",
        failureName: "Drain-tank rupture and sodium release",
        failureType: "FIRE_IGNITION_SOURCE",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "A large sodium release can ignite and damage shared service equipment.",
        inclusionSources: ["INTERNAL_FIRE_IGNITION_SOURCE", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Tank shell and anchorage capacity exceed the selected threshold.",
        mounting: "Skirt-supported vertical tank on an anchored reinforced-concrete pedestal.",
        systemRef: "SYSTEM-SODIUM-SERVICE",
        responseModel: "SUPPORT",
      },
      {
        id: "STEAM-WATER",
        name: "Feedwater header near sodium steam generators",
        sscType: "FLOOD_SOURCE",
        building: "Steam-generator and sodium-service building",
        room: "Steam-generator bay",
        elevation: "818.0 m",
        function: "Maintain water and steam pressure boundary near sodium systems",
        failureName: "Seismic feedwater line break",
        failureType: "FLOOD_SOURCE",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Flooding and sodium-water interaction can disable a heat-transport train.",
        inclusionSources: ["INTERNAL_FLOOD_SOURCE", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Piping stress and support review screen the rupture; branch-line interactions remain controlled.",
        mounting: "Welded high-energy piping with snubbers and structural steel supports.",
        systemRef: "SYSTEM-POWER-CONVERSION",
        responseModel: "SUPPORT",
      },
      {
        id: "SERVICE-WATER",
        name: "Service-water header in electrical building",
        sscType: "FLOOD_SOURCE",
        building: "Control and electrical building",
        room: "Mechanical services corridor",
        elevation: "804.0 m",
        function: "Maintain non-safety cooling-water boundary adjacent to electrical rooms",
        failureName: "Seismic service-water pipe rupture",
        failureType: "FLOOD_SOURCE",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Spray or flooding can disable redundant electrical divisions.",
        inclusionSources: ["INTERNAL_FLOOD_SOURCE", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Pipe supports screen; local spray shields and drainage are included in the disposition.",
        mounting: "Welded steel piping with trapeze supports and lateral bracing.",
        systemRef: "SYSTEM-SERVICE-WATER",
        responseModel: "CONTROL",
      },
      {
        id: "CONFINEMENT-DAMPER",
        name: "Confinement isolation damper train A",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Confinement ventilation gallery",
        elevation: "833.0 m",
        function: "Isolate the confinement ventilation boundary after a release",
        failureName: "Isolation damper fails to close",
        failureType: "FUNCTIONAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Increases the release fraction for damaged-fuel sequences.",
        inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Actuator, blade, and frame qualification exceed threshold.",
        mounting: "Duct-mounted damper on a braced steel frame with flexible connectors.",
        systemRef: "SYSTEM-CONFINEMENT",
        responseModel: "RB",
      },
      {
        id: "FUEL-HANDLING",
        name: "In-vessel fuel handling machine",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Reactor head service level",
        elevation: "833.5 m",
        function: "Remain stable and clear of safety-significant SSCs during non-refueling states",
        failureName: "Fuel handling machine overturning or impact",
        failureType: "SEISMIC_INTERACTION",
        requiredState: "OTHER",
        consequence: "Impact can damage the reactor head, shutdown drives, or nearby handling systems.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "INVESTIGATION_FINDING"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Parked configuration, restraints, and exclusion zone are verified by design review.",
        mounting: "Rail-mounted machine with seismic parking pins and travel stops.",
        systemRef: "SYSTEM-FUEL-HANDLING",
        responseModel: "RB",
      },
      {
        id: "SPENT-FUEL-VESSEL",
        name: "In-vessel spent-fuel storage basket",
        sscType: "COMPONENT",
        building: reactorBuilding,
        room: "Spent-fuel storage region",
        elevation: "805.0 m",
        function: "Maintain subcritical geometry and sodium cooling for stored fuel",
        failureName: "Basket distortion or support failure",
        failureType: "STRUCTURAL",
        requiredState: "MAINTAIN_BOUNDARY",
        consequence: "Can challenge spent-fuel cooling or geometry control.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "INHERENTLY_RUGGED",
        dispositionBasis: "Submerged compact welded basket has substantial seismic capacity and limited interaction potential.",
        mounting: "Welded basket seated in a guided support structure within the reactor vessel.",
        systemRef: "SYSTEM-SPENT-FUEL",
        responseModel: "RB",
      },
      {
        id: "CABLE-TRAYS",
        name: "Protection and DC cable tray supports",
        sscType: "OTHER",
        building: "Control and electrical building",
        room: "Cable spreading areas",
        elevation: "804.0-813.0 m",
        function: "Preserve separation and support for protection and DC circuits",
        failureName: "Cable tray support failure and interaction",
        failureType: "SEISMIC_INTERACTION",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Falling trays can damage redundant divisions and impede access.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "INVESTIGATION_FINDING"],
        disposition: "INHERENTLY_RUGGED",
        dispositionBasis: "Standard braced configurations are rugged; nonstandard transitions are separately tracked.",
        mounting: "Braced trapeze and wall-mounted supports with configuration-controlled span limits.",
        systemRef: "SYSTEM-ELECTRICAL-DISTRIBUTION",
        responseModel: "CONTROL",
      },
    ];
  }

  return [
    {
      id: "PRIMARY",
      name: "Helium circulator HC-1",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Helium service area",
      elevation: "1460 m",
      function: "Maintain forced helium circulation when credited",
      failureName: "Loss of helium circulator HC-1 credited function",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Increases fuel and vessel temperatures until passive heat removal establishes.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ACTIVE",
      dispositionBasis: "Explicitly modeled because functional capacity and support response are risk-significant.",
      mounting: "Vertical circulator casing bolted to the steam-generator vessel with qualified internal bearings.",
      systemRef: "SYSTEM-PRIMARY-HEAT-TRANSPORT",
      orientation: "Vertical shaft with plant X-Y lateral input",
      responseModel: "SUPPORT",
    },
    {
      id: "SECONDARY",
      name: "Reactor cavity cooling panel RCCS-1",
      sscType: "SYSTEM",
      building: reactorBuilding,
      room: "Reactor cavity annulus",
      elevation: "1450-1482 m",
      function: "Provide passive cavity heat removal",
      failureName: "Loss of RCCS-1 credited heat-removal function",
      failureType: "ANCHORAGE",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Removes a passive decay-heat-removal path and drives the leading seismic sequence.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SECONDARY_HAZARD", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ACTIVE",
      dispositionBasis: "Panel support and service-header deformation remain risk-significant after screening.",
      mounting: "Suspended steel cooling panels with guided lower supports and flexible header connections.",
      systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
      orientation: "Distributed around reactor cavity",
      responseModel: "RB",
    },
    {
      id: "REACTOR-BUILDING",
      name: "Reactor building and common basemat",
      sscType: "STRUCTURE",
      building: reactorBuilding,
      room: "Basemat through roof",
      elevation: "1438-1494 m",
      function: "Support and protect four reactor modules and shared safety-significant SSCs",
      failureName: "Reactor building structural yielding or excessive drift",
      failureType: "STRUCTURAL",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Common structural failure can affect multiple modules and shared heat removal.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Nonlinear shear-wall and basemat capacity exceed the cumulative threshold.",
      mounting: "Embedded reinforced-concrete shear-wall structure on a common basemat.",
      structureRef: "STRUCTURE-REACTOR-BUILDING",
      responseModel: "RB",
    },
    {
      id: "REACTOR-VESSEL",
      name: "Module 1 reactor vessel and support",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Module 1 reactor cavity",
      elevation: "1448 m",
      function: "Maintain fuel geometry, primary helium boundary, and core support",
      failureName: "Reactor vessel support or pressure-boundary failure",
      failureType: "PRESSURE_BOUNDARY",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Challenges all core heat-removal paths for the affected module.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Prestressed vessel, support, and restraint capacity exceed the threshold.",
      mounting: "Top-supported vessel with radial keys and vertical hold-downs at the support ledge.",
      systemRef: "SYSTEM-REACTOR-VESSEL",
      responseModel: "RB",
    },
    {
      id: "HOT-GAS-DUCT",
      name: "Module 1 hot gas duct",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Module 1 cross-vessel gallery",
      elevation: "1464 m",
      function: "Maintain the primary helium pressure boundary between reactor and steam generator",
      failureName: "Hot gas duct pressure-boundary or support failure",
      failureType: "PRESSURE_BOUNDARY",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Depressurizes the primary system and changes passive heat-transfer conditions.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Bellows, liner, and vessel nozzle capacities exceed screened demand.",
      mounting: "Short coaxial duct between vessel nozzles with internal support and expansion accommodation.",
      systemRef: "SYSTEM-PRIMARY-HEAT-TRANSPORT",
      orientation: "Module radial axis",
      responseModel: "RB",
    },
    {
      id: "HELIUM-CIRC-HC2",
      name: "Helium circulator HC-2",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Helium service area",
      elevation: "1460 m",
      function: "Provide redundant forced helium circulation",
      failureName: "Loss of helium circulator HC-2",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Reduces forced-cooling redundancy.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Common qualification and train-specific demand remain above the threshold.",
      mounting: "Vertical circulator casing bolted to the steam-generator vessel.",
      systemRef: "SYSTEM-PRIMARY-HEAT-TRANSPORT",
      responseModel: "SUPPORT",
    },
    {
      id: "SHUTDOWN-CIRC",
      name: "Shutdown cooling circulator SC-1",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Shutdown cooling equipment room",
      elevation: "1456 m",
      function: "Provide forced cooling during shutdown and refueling states",
      failureName: "Shutdown cooling circulator fails to start or run",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Challenges shutdown-state decay-heat removal.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Equipment qualification and anchorage exceed the shutdown-state threshold.",
      mounting: "Skid-mounted circulator with bolted frame and flexible helium connections.",
      systemRef: "SYSTEM-SHUTDOWN-COOLING",
      responseModel: "SUPPORT",
    },
    {
      id: "RCCS-HEADER",
      name: "RCCS water header train A",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "RCCS header gallery",
      elevation: "1452 m",
      function: "Distribute natural-circulation water to reactor cavity cooling panels",
      failureName: "RCCS header rupture or support failure",
      failureType: "PRESSURE_BOUNDARY",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Disables one RCCS train and can flood lower service areas.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FLOOD_SOURCE"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Welded header, supports, and branch flexibility screen above threshold.",
      mounting: "Welded stainless header on guided and anchored structural supports.",
      systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
      responseModel: "RB",
    },
      {
        id: "RCCS-AIR-INLET",
        name: "RCCS water-to-air heat exchanger and chimney",
        sscType: "SYSTEM",
        building: "RCCS heat-rejection and chimney structure",
        room: "Outdoor heat exchanger, intake, and exhaust stack",
        elevation: "1444-1502 m",
        function: "Reject heat from the natural-circulation RCCS water loops to outdoor air without active power",
        failureName: "RCCS heat-exchanger support, intake, or chimney failure",
        failureType: "STRUCTURAL",
        requiredState: "FUNCTION_AFTER_EARTHQUAKE",
        consequence: "Reduces the passive atmospheric heat sink shared by the connected modules.",
        inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
        disposition: "ABOVE_FRAGILITY_THRESHOLD",
        dispositionBasis: "Heat-exchanger frame, water connections, stack shell, intake louvers, and debris exclusion exceed threshold.",
        mounting: "Braced heat-exchanger frame and ductwork within a reinforced-concrete intake structure with a steel exhaust stack.",
        structureRef: "STRUCTURE-RCCS-INTAKE",
        responseModel: "DHR",
    },
    {
      id: "CRDM",
      name: "Module 1 control rod drive mechanisms",
      sscType: "SYSTEM",
      building: reactorBuilding,
      room: "Module 1 reactor head service level",
      elevation: "1481 m",
      function: "Insert shutdown rods on a reactor trip",
      failureName: "Control rods fail to insert",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_DURING_EARTHQUAKE",
      consequence: "Prevents prompt shutdown of one module.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Drop testing, guide alignment, and support capacity exceed the threshold.",
      mounting: "Head-mounted drives with laterally braced support frame.",
      systemRef: "SYSTEM-REACTOR-SHUTDOWN",
      responseModel: "RB",
    },
    {
      id: "RESERVE-SHUTDOWN",
      name: "Reserve shutdown material hopper",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Module 1 reactor head service level",
      elevation: "1483 m",
      function: "Deliver reserve shutdown material by gravity",
      failureName: "Reserve shutdown hopper fails to discharge",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Eliminates the diverse long-term shutdown path.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Gravity discharge path and support qualification exceed threshold.",
      mounting: "Welded hopper and discharge tube on an anchored steel frame.",
      systemRef: "SYSTEM-RESERVE-SHUTDOWN",
      responseModel: "RB",
    },
    {
      id: "RTS-CABINET",
      name: "Module protection system cabinet A",
      sscType: "CABINET",
      building: "Control and electrical building",
      room: "Protection system room A",
      elevation: "1450 m",
      function: "Generate module trip and engineered safeguard signals",
      failureName: "Protection cabinet loss of function",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_DURING_EARTHQUAKE",
      consequence: "Can prevent automatic trip or spurious actuation of shared support systems.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Cabinet anchorage and internal module qualification exceed threshold.",
      mounting: "Four-point floor anchorage with top bracing and qualified internal modules.",
      systemRef: "SYSTEM-REACTOR-PROTECTION",
      responseModel: "CONTROL",
    },
    {
      id: "RTS-RELAY",
      name: "Module trip undervoltage relay",
      sscType: "RELAY",
      building: "Control and electrical building",
      room: "Protection system room A",
      elevation: "1450 m",
      function: "Initiate trip logic on loss of power",
      failureName: "Relay contact chatter causes failed or spurious actuation",
      failureType: "CONTACT_CHATTER",
      requiredState: "FUNCTION_DURING_EARTHQUAKE",
      consequence: "Can defeat a trip channel or spuriously disable support loads.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Plant-specific chatter qualification exceeds the screening motion.",
      mounting: "Panel-mounted relay with qualified socket and restraint clip.",
      systemRef: "SYSTEM-ELECTRICAL-PROTECTION",
      responseModel: "CONTROL",
    },
    {
      id: "DC-BATTERY-A",
      name: "Division A DC battery rack",
      sscType: "COMPONENT",
      building: "Control and electrical building",
      room: "Battery room A",
      elevation: "1446 m",
      function: "Supply uninterrupted DC power to protection and isolation loads",
      failureName: "Battery rack anchorage or cell-connection failure",
      failureType: "ANCHORAGE",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Disables one division of module protection, indication, and valve loads.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Rack anchorage and intercell connection tests exceed threshold.",
      mounting: "Restrained two-tier rack with embedded anchors and cell spacers.",
      systemRef: "SYSTEM-DC-POWER",
      responseModel: "CONTROL",
    },
    {
      id: "DC-BATTERY-B",
      name: "Division B DC battery rack",
      sscType: "COMPONENT",
      building: "Control and electrical building",
      room: "Battery room B",
      elevation: "1446 m",
      function: "Supply the redundant DC protection and isolation division",
      failureName: "Battery rack B anchorage or connection failure",
      failureType: "ANCHORAGE",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Removes the redundant DC division.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "INTERNAL_FIRE_IGNITION_SOURCE"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Common qualification is confirmed against train-specific floor response.",
      mounting: "Restrained two-tier rack with embedded anchors and cell spacers.",
      systemRef: "SYSTEM-DC-POWER",
      responseModel: "CONTROL",
    },
    {
      id: "SWITCHGEAR",
      name: "Safety-related low-voltage switchgear A",
      sscType: "CABINET",
      building: "Control and electrical building",
      room: "Switchgear room A",
      elevation: "1446 m",
      function: "Distribute AC power to credited shutdown and support loads",
      failureName: "Switchgear functional or anchorage failure",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Causes a loss of powered support functions for multiple modules.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL", "ADDITIONAL_SEISMIC_SSC"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Lineup anchorage, bus bracing, and breaker qualification exceed threshold.",
      mounting: "Multi-bay lineup anchored to a housekeeping pad with inter-bay bolting.",
      systemRef: "SYSTEM-AC-POWER",
      responseModel: "CONTROL",
    },
    {
      id: "HELIUM-ISOLATION",
      name: "Primary helium isolation valve pair",
      sscType: "COMPONENT",
      building: reactorBuilding,
      room: "Helium service area",
      elevation: "1458 m",
      function: "Isolate a primary helium leak",
      failureName: "Helium isolation valves fail to close",
      failureType: "FUNCTIONAL",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Allows continued depressurization and changes fission-product transport.",
      inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Valve operators, yokes, and piping loads remain above threshold.",
      mounting: "In-line valves with independent pipe supports and qualified actuators.",
      systemRef: "SYSTEM-PRIMARY-HELIUM",
      responseModel: "SUPPORT",
    },
    {
      id: "SERVICE-WATER",
      name: "Service-water header above electrical rooms",
      sscType: "FLOOD_SOURCE",
      building: "Control and electrical building",
      room: "Mechanical services corridor",
      elevation: "1454 m",
      function: "Maintain the cooling-water boundary adjacent to electrical divisions",
      failureName: "Seismic service-water pipe rupture",
      failureType: "FLOOD_SOURCE",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Spray or flooding can disable redundant electrical divisions.",
      inclusionSources: ["INTERNAL_FLOOD_SOURCE", "ADDITIONAL_SEISMIC_SSC"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Pipe support review, spray shields, and drainage support screening.",
      mounting: "Welded steel piping with braced trapeze supports.",
      systemRef: "SYSTEM-SERVICE-WATER",
      responseModel: "CONTROL",
    },
    {
      id: "RCCS-WATER",
      name: "RCCS expansion tank",
      sscType: "FLOOD_SOURCE",
      building: reactorBuilding,
      room: "RCCS upper gallery",
      elevation: "1487 m",
      function: "Maintain RCCS inventory and static head",
      failureName: "Expansion-tank rupture and drain-down",
      failureType: "FLOOD_SOURCE",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Reduces RCCS inventory and floods the upper service gallery.",
      inclusionSources: ["INTERNAL_FLOOD_SOURCE", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Tank shell, legs, anchors, and connected piping exceed threshold.",
      mounting: "Leg-supported tank on an anchored structural-steel platform.",
      systemRef: "SYSTEM-DECAY-HEAT-REMOVAL",
      responseModel: "RB",
    },
    {
      id: "TRANSFORMER",
      name: "Unit auxiliary transformer",
      sscType: "FIRE_SOURCE",
      building: "Electrical yard",
      room: "Outdoor transformer bay",
      elevation: "1442 m",
      function: "Remain stable and separated from credited power and control equipment",
      failureName: "Transformer bushing failure and oil ignition",
      failureType: "FIRE_IGNITION_SOURCE",
      requiredState: "OTHER",
      consequence: "An oil fire can damage shared cable routes and challenge off-site power recovery.",
      inclusionSources: ["INTERNAL_FIRE_IGNITION_SOURCE", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Anchorage, bushing qualification, separation, and fire barriers support screening.",
      mounting: "Anchored transformer tank on a reinforced-concrete pad with firewall separation.",
      systemRef: "SYSTEM-OFFSITE-POWER",
      responseModel: "SUPPORT",
    },
    {
      id: "BATTERY-CHARGER",
      name: "Division A battery charger",
      sscType: "FIRE_SOURCE",
      building: "Control and electrical building",
      room: "DC equipment room A",
      elevation: "1446 m",
      function: "Maintain DC battery charge without becoming a fire source",
      failureName: "Charger cabinet fault and ignition",
      failureType: "FIRE_IGNITION_SOURCE",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Can disable the associated DC division and challenge separation.",
      inclusionSources: ["INTERNAL_FIRE_IGNITION_SOURCE", "INTERNAL_EVENTS_SYSTEM_MODEL"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Cabinet anchorage, internal qualification, and fire separation exceed threshold.",
      mounting: "Floor-anchored metal cabinet with qualified internal transformer and bus.",
      systemRef: "SYSTEM-DC-POWER",
      responseModel: "CONTROL",
    },
    {
      id: "SPENT-FUEL-VAULT",
      name: "Spent-fuel storage vault",
      sscType: "STRUCTURE",
      building: "Fuel handling building",
      room: "Dry spent-fuel vault",
      elevation: "1442-1470 m",
      function: "Maintain fuel geometry, shielding, and passive cooling",
      failureName: "Vault structural failure or cooling-channel blockage",
      failureType: "STRUCTURAL",
      requiredState: "MAINTAIN_BOUNDARY",
      consequence: "Can challenge cooling and confinement for stored fuel.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "SEISMIC_EVENT_SEQUENCE_MODEL"],
      disposition: "INHERENTLY_RUGGED",
      dispositionBasis: "Massive reinforced-concrete vault and passive air channels have capacity beyond the risk range.",
      mounting: "Basemat-supported reinforced-concrete vault with integral storage tubes.",
      structureRef: "STRUCTURE-SPENT-FUEL-VAULT",
      responseModel: "SUPPORT",
    },
    {
      id: "POLAR-CRANE",
      name: "Module service crane",
      sscType: "OTHER",
      building: reactorBuilding,
      room: "Reactor building high bay",
      elevation: "1490 m",
      function: "Remain restrained in the parked configuration",
      failureName: "Crane derailment or dropped load interaction",
      failureType: "SEISMIC_INTERACTION",
      requiredState: "OTHER",
      consequence: "Falling or displaced crane components can damage reactor head and RCCS equipment.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "INVESTIGATION_FINDING"],
      disposition: "ABOVE_FRAGILITY_THRESHOLD",
      dispositionBasis: "Parking restraints, end stops, and load-control rules are verified by design review.",
      mounting: "Bridge crane on runway rails with seismic clips and parking restraints.",
      systemRef: "SYSTEM-FUEL-HANDLING",
      responseModel: "RB",
    },
    {
      id: "CABLE-TRAYS",
      name: "Protection and DC cable tray supports",
      sscType: "OTHER",
      building: "Control and electrical building",
      room: "Cable spreading areas",
      elevation: "1446-1460 m",
      function: "Preserve separation and support for protection and DC circuits",
      failureName: "Cable tray support failure and interaction",
      failureType: "SEISMIC_INTERACTION",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE",
      consequence: "Falling trays can damage redundant divisions and impede operator access.",
      inclusionSources: ["ADDITIONAL_SEISMIC_SSC", "INVESTIGATION_FINDING"],
      disposition: "INHERENTLY_RUGGED",
      dispositionBasis: "Standard braced configurations are rugged; nonstandard transitions are tracked.",
      mounting: "Braced trapeze and wall-mounted supports with controlled span limits.",
      systemRef: "SYSTEM-ELECTRICAL-DISTRIBUTION",
      responseModel: "CONTROL",
    },
  ];
}

function buildEquipment(
  kind: ReactorKind,
  reactorBuilding: string,
): {
  entries: SeismicEquipmentListEntry[];
  responseGroups: Map<EquipmentTemplate["responseModel"], string[]>;
} {
  const prefix = kind.toUpperCase();
  const responseGroups = new Map<EquipmentTemplate["responseModel"], string[]>([
    ["RB", []],
    ["SUPPORT", []],
    ["DHR", []],
    ["CONTROL", []],
  ]);
  const entries = equipmentTemplates(kind, reactorBuilding).map((template) => {
    const uuid = template.id === "PRIMARY" || template.id === "SECONDARY"
      ? `SEL-${template.id}`
      : `SEL-${prefix}-${template.id}`;
    const failureUuid = template.id === "PRIMARY" || template.id === "SECONDARY"
      ? `FAILURE-MODE-${template.id}`
      : `FAILURE-MODE-${prefix}-${template.id}`;
    responseGroups.get(template.responseModel)!.push(uuid);
    const active = template.disposition === "ACTIVE";
    const parentSscRef = template.id === "REACTOR-BUILDING"
      ? undefined
      : template.id === "RTS-RELAY"
        ? `SEL-${prefix}-RTS-CABINET`
        : template.responseModel === "RB"
          ? `SEL-${prefix}-REACTOR-BUILDING`
          : template.responseModel === "CONTROL"
            ? "STRUCTURE-CONTROL-AND-ELECTRICAL-BUILDING"
            : template.responseModel === "DHR"
              ? `STRUCTURE-${prefix}-DECAY-HEAT-REMOVAL`
              : `STRUCTURE-${prefix}-SUPPORT-SERVICES`;
    return {
      uuid,
      name: template.name,
      sscType: template.sscType,
      componentRef: template.sscType === "COMPONENT" ? `COMPONENT-${prefix}-${template.id}` : undefined,
      systemRef: template.systemRef,
      structureRef: template.structureRef,
      parentSscRef,
      reactorUnitRefs: [kind === "sfr" ? "UNIT-1" : "MODULES-1-4"],
      radioactiveMaterialSourceRefs: ["SOURCE-REACTOR"],
      building: template.building,
      roomOrArea: template.room,
      elevation: template.elevation,
      orientation: template.orientation ?? "Plant coordinate axes",
      mountingAndAnchorage: template.mounting,
      creditedFunctions: [template.function],
      inclusionSources: template.inclusionSources,
      sourceElementRefs: [
        template.systemRef ?? template.structureRef ?? `SOURCE-${prefix}-${template.id}`,
        "ES-SEISMIC-DAMAGE",
      ],
      failureModes: [{
        uuid: failureUuid,
        name: template.failureName,
        failureModeType: template.failureType,
        description: template.failureName,
        creditedFunction: template.function,
        failureDefinition: `Loss of the credited state for ${template.function.toLowerCase()}.`,
        requiredState: template.requiredState,
        systemModelBasicEventRefs: [`BE-${uuid}`],
        eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
        inducedBySecondaryHazardRef: template.inclusionSources.includes("SECONDARY_HAZARD")
          ? "SECONDARY-LIQUEFACTION"
          : undefined,
        fragilityMechanismRefs: active
          ? [`MECHANISM-${template.id}`]
          : [],
        consequenceDescription: template.consequence,
        implementsSrs: srs("SPR-C6", "SFR-A1"),
      }],
      correlationGroupRefs: active ? ["CORR-COLOCATED-EQUIPMENT"] : [],
      fragilityAnalysisRef: active ? `FRAGILITY-${template.id}` : undefined,
      disposition: template.disposition,
      dispositionBasis: template.dispositionBasis,
      revisionHistory: [{
        date: "2026-05-01",
        action: "ADDED" as const,
        reason: "Initial systems, hazard-source, and structural scope reconciliation",
        actor: "example.preparer",
      }, {
        date: "2026-06-12",
        action: "UPDATED" as const,
        reason: "Response location, failure mode, and screening disposition confirmed",
        actor: "example.fragility.lead",
      }],
      implementsSrs: srs("SPR-C1", "SPR-C2", "SPR-C3", "SPR-C4", "SPR-C5", "SPR-C6", "SFR-A1"),
    } satisfies SeismicEquipmentListEntry;
  });
  return { entries, responseGroups };
}

function spectrum(
  kind: ReactorKind,
  model: EquipmentTemplate["responseModel"],
  direction: "X" | "Y" | "Z",
): { frequencyHz: number; periodSeconds: number; medianResponse: number }[] {
  const frequencies = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 33];
  const modelFactor = { RB: 1, SUPPORT: 0.88, DHR: 1.08, CONTROL: 1.16 }[model];
  const directionFactor = direction === "X" ? 1 : direction === "Y" ? 0.94 : 0.72;
  const peakFrequency = kind === "sfr"
    ? { RB: 4.2, SUPPORT: 6.8, DHR: 3.4, CONTROL: 7.5 }[model]
    : { RB: 3.6, SUPPORT: 7.2, DHR: 2.8, CONTROL: 8.5 }[model];
  const base = kind === "sfr" ? 0.44 : 0.38;
  return frequencies.map((frequencyHz) => {
    const resonance = Math.exp(-((Math.log(frequencyHz / peakFrequency)) ** 2) / 0.42);
    const highFrequencyShoulder = 0.18 * Math.exp(-((Math.log(frequencyHz / 15)) ** 2) / 0.65);
    const medianResponse = base * modelFactor * directionFactor
      * (0.72 + 2.45 * resonance + highFrequencyShoulder);
    return {
      frequencyHz,
      periodSeconds: Number((1 / frequencyHz).toPrecision(6)),
      medianResponse: Number(medianResponse.toPrecision(5)),
    };
  });
}

function structuralModels(
  kind: ReactorKind,
  reactorBuilding: string,
): StructuralModel[] {
  const prefix = kind.toUpperCase();
  const configurations: {
    id: EquipmentTemplate["responseModel"];
    name: string;
    structureRef: string;
    condition: StructuralModel["asModeledCondition"];
    foundation: string;
    frequency: number;
    limitation: string;
  }[] = kind === "sfr"
    ? [
      { id: "RB", name: "Reactor building coupled 3-D model", structureRef: "STRUCTURE-REACTOR-BUILDING", condition: "AS_INTENDED_TO_OPERATE", foundation: "Embedded basemat with frequency-dependent soil impedance and sidewall interaction.", frequency: 4.1, limitation: "Final equipment mass distribution requires as-built confirmation." },
      { id: "SUPPORT", name: "Steam-generator and sodium-service building model", structureRef: "STRUCTURE-SODIUM-SERVICE", condition: "AS_DESIGNED", foundation: "Shallow mat with structure-soil-structure coupling to the reactor building.", frequency: 6.6, limitation: "Final secondary piping support stiffness remains configuration controlled." },
      { id: "DHR", name: "Decay-heat-removal structure model", structureRef: "STRUCTURE-DHR", condition: "AS_DESIGNED", foundation: "Shallow mat and flexible service trench modeled with site-specific springs.", frequency: 3.3, limitation: "Localized trench deformation is evaluated separately as a secondary hazard." },
      { id: "CONTROL", name: "Control and electrical building model", structureRef: "STRUCTURE-CONTROL-BUILDING", condition: "AS_DESIGNED", foundation: "Embedded strip foundation with coupled translational and rocking impedance.", frequency: 7.4, limitation: "Nonstructural partition mass is represented by an uncertainty range." },
    ]
    : [
      { id: "RB", name: "Four-module reactor building 3-D model", structureRef: "STRUCTURE-REACTOR-BUILDING", condition: "AS_INTENDED_TO_OPERATE", foundation: "Embedded common basemat with frequency-dependent soil impedance and sidewall interaction.", frequency: 3.5, limitation: "Final module service-platform mass requires as-built confirmation." },
      { id: "SUPPORT", name: "Helium service and fuel-handling structure model", structureRef: "STRUCTURE-HELIUM-SERVICE", condition: "AS_DESIGNED", foundation: "Shared foundation interfaces and building-to-building gaps are represented.", frequency: 7.1, limitation: "Final vendor package masses remain configuration controlled." },
      { id: "DHR", name: "RCCS heat-rejection and chimney model", structureRef: "STRUCTURE-RCCS-INTAKE", condition: "AS_DESIGNED", foundation: "Shallow foundation with translational and rocking springs.", frequency: 2.7, limitation: "Final heat-exchanger frame and intake-louver stiffness are bounded by sensitivity cases." },
      { id: "CONTROL", name: "Control and electrical building model", structureRef: "STRUCTURE-CONTROL-BUILDING", condition: "AS_DESIGNED", foundation: "Embedded strip foundation with structure-soil-structure coupling to the reactor building.", frequency: 8.2, limitation: "Distributed cable and raceway mass is sampled over the design range." },
    ];
  return configurations.map((configuration) => ({
    uuid: `STRUCTURAL-MODEL-${configuration.id}`,
    name: configuration.name,
    structureRef: configuration.structureRef,
    modelType: "THREE_DIMENSIONAL_FINITE_ELEMENT",
    softwareAndVersion: "Project finite-element solver 2026.1",
    modelFileRefs: [`${prefix}-${configuration.id}-MODEL-R4`, `${prefix}-${configuration.id}-MASS-R3`],
    asModeledCondition: configuration.condition,
    stiffnessRepresentation: "Median cracked stiffness with epistemic low, best-estimate, and high branches.",
    massRepresentation: "Distributed structural mass, permanent loads, operating inventories, and explicit major equipment masses.",
    dampingRepresentation: "Median damping varies by material and response level; damping uncertainty is sampled.",
    stressStateRepresentation: "Gravity, operating pressure, thermal preload, and prestress are included where applicable.",
    directionalCoupling: "Three translational components are applied simultaneously in the plant coordinate system.",
    rotationalInertia: "Floor and major equipment rotational inertia are explicitly represented.",
    diaphragmFlexibility: "Shell-element diaphragms retain in-plane and out-of-plane flexibility.",
    torsionalEffects: "Mass and stiffness eccentricity produce explicit coupled torsional modes.",
    structuralCoupling: "Shared foundations, adjoining structures, penetrations, and seismic gaps are represented as applicable.",
    foundationAndEmbedment: configuration.foundation,
    nonlinearFeatures: [
      "Foundation uplift and gapping sensitivity",
      "Concrete stiffness degradation at upper hazard levels",
      "Building-to-building gap closure where applicable",
    ],
    modalProperties: [
      { mode: 1, frequencyHz: configuration.frequency, dampingRatio: 0.05, direction: "X", massParticipationFraction: 0.48 },
      { mode: 2, frequencyHz: Number((configuration.frequency * 1.08).toFixed(2)), dampingRatio: 0.05, direction: "Y", massParticipationFraction: 0.46 },
      { mode: 3, frequencyHz: Number((configuration.frequency * 1.32).toFixed(2)), dampingRatio: 0.05, direction: "Torsion", massParticipationFraction: 0.12 },
      { mode: 4, frequencyHz: Number((configuration.frequency * 1.78).toFixed(2)), dampingRatio: 0.04, direction: "Z", massParticipationFraction: 0.51 },
      { mode: 5, frequencyHz: Number((configuration.frequency * 2.15).toFixed(2)), dampingRatio: 0.04, direction: "X", massParticipationFraction: 0.18 },
      { mode: 6, frequencyHz: Number((configuration.frequency * 2.42).toFixed(2)), dampingRatio: 0.04, direction: "Y", massParticipationFraction: 0.16 },
    ],
    verificationAndValidation: "Independent model review, mass and stiffness reconciliation, mode-shape inspection, static checks, mesh refinement, and benchmark response comparison are complete.",
    limitations: [configuration.limitation],
    implementsSrs: srs("SFR-B2", "SFR-B3", "SFR-B4"),
  }));
}

function populateSelAndResponse(
  mef: SeismicPRA,
  kind: ReactorKind,
  reactorBuilding: string,
): SeismicEquipmentListEntry[] {
  const prefix = kind.toUpperCase();
  const { entries, responseGroups } = buildEquipment(kind, reactorBuilding);
  const spr = mef.seismicPlantResponseAnalysis;
  const sfr = mef.seismicFragilityAnalysis;
  const activeRefs = entries
    .filter((entry) => entry.disposition === "ACTIVE")
    .map((entry) => entry.uuid);

  spr.seismicEquipmentListDevelopment = {
    internalEventsSystemsModelRef: kind === "sfr"
      ? "SY-SFR-CCII-BASELINE-R6"
      : "SY-HTGR-MULTIMODULE-CCII-R8",
    additionalSeismicSystemRefs: kind === "sfr"
      ? ["SYSTEM-DECAY-HEAT-REMOVAL", "SYSTEM-CONFINEMENT", "SYSTEM-SPENT-FUEL"]
      : ["SYSTEM-RCCS-AIR-PATH", "SYSTEM-RESERVE-SHUTDOWN", "SYSTEM-SPENT-FUEL"],
    equipment: entries,
    internalFloodSourceRefs: entries
      .filter((entry) => entry.sscType === "FLOOD_SOURCE")
      .map((entry) => entry.uuid),
    internalFireIgnitionSourceRefs: entries
      .filter((entry) => entry.sscType === "FIRE_SOURCE")
      .map((entry) => entry.uuid),
    secondaryHazardSscRefs: entries
      .filter((entry) => entry.inclusionSources.includes("SECONDARY_HAZARD"))
      .map((entry) => entry.uuid),
    additionalStructuresAndPassiveSscRefs: entries
      .filter((entry) =>
        entry.sscType === "STRUCTURE"
        || entry.disposition === "INHERENTLY_RUGGED")
      .map((entry) => entry.uuid),
    failureModeIdentificationProcess: "Trace every direct and secondary seismic initiator through the internal-events systems model, seismic event sequences, passive structures, relays, cabinets, flood and fire sources, support systems, and spatial interactions. Define the lost credited state and system basic event for each retained SSC.",
    systemsFragilityAnalystCoordination: "Systems, operations, structural, geotechnical, and fire/flood specialists reconcile identifiers, functions, locations, mounting, parent relationships, failure definitions, plant-model consequences, and preliminary correlation groups before demand and fragility work begins.",
    completenessChecks: [
      "Every baseline systems basic event retained for seismic resolves to an SEL failure mode",
      "Structures, relays, cabinets, passive SSCs, flood sources, and fire sources are included",
      "Every secondary-hazard candidate resolves to inducing or affected SEL items",
      "Every SEL item records its plant identifier, location, mounting, and parent structure or cabinet",
      "Every failure mode states the credited function, failure definition, consequence, and basic-event mapping",
      "Correlation groups use common demand, construction, installation, location, and orientation evidence",
      "Removed or preliminarily screened items retain a technical basis",
      "Revision review reconciles systems-model and SEL changes",
    ],
    revisionBasis: "Revision 1 assembles the initial SEL from the controlled systems model, seismic-only structures and passive SSCs, relay and cabinet scope, internal fire and flood sources, secondary-hazard candidates, and preliminary failure-consequence mapping current through 2026-05-01.",
    implementsSrs: srs("SPR-C1", "SPR-C2", "SPR-C3", "SPR-C4", "SPR-C5", "SPR-C6", "SFR-A1", "SFR-A2"),
  };

  sfr.scope.seismicEquipmentListRef = "SEL-2026-R4";
  sfr.scope.includedSscRefs = entries.map((entry) => entry.uuid);
  sfr.scope.correlationGroupRefs = ["CORR-COLOCATED-EQUIPMENT"];
  sfr.scope.scopeEvolutionSummary = `${entries.length} SSCs were reconciled from systems logic, structures, passive components, relays, flood/fire sources, secondary hazards, and investigation findings; threshold dispositions remain visible in the controlled SEL.`;
  sfr.scope.systemsFragilityAlignment = "Every active failure mode maps to a controlling fragility and every screened item retains its threshold or ruggedness basis.";
  sfr.scope.implementsSrs = srs("SFR-A1", "SFR-A2");

  const models = structuralModels(kind, reactorBuilding);
  const referenceLevels = kind === "sfr"
    ? [0.42, 0.74, 1.18]
    : [0.36, 0.65, 1.04];
  const annualFrequencies = [1e-4, 1e-5, 1e-6];
  const spectra = ["UHS-1E-4-H", "UHS-1E-5-H", "UHS-1E-6-H"];
  const inputSuites = ["INPUT-SUITE-1E-4", "INPUT-SUITE-1E-5", "INPUT-SUITE-1E-6"];
  const names = [
    "Risk-central reference earthquake",
    "Upper-tail response earthquake",
    "Hazard-range closure earthquake",
  ];
  const referenceEarthquakes: ResponseAnalysis["referenceEarthquakes"] =
    annualFrequencies.map((annualFrequency, index) => ({
      uuid: index === 0 ? "REFERENCE-EQ-1" : `REFERENCE-EQ-${index + 1}`,
      name: names[index]!,
      hazardSpectrumRef: spectra[index]!,
      groundMotionParameterRef: "GMP-SA-1HZ",
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      annualFrequencyOfExceedance: annualFrequency,
      groundMotionLevel: referenceLevels[index]!,
      groundMotionUnits: "g",
      horizontalComponentRefs: [
        `${inputSuites[index]}-H1`,
        `${inputSuites[index]}-H2`,
      ],
      verticalComponentRef: `${inputSuites[index]}-V`,
      hazardRangeOfInterest: {
        lowerGroundMotion: index === 0 ? 0.08 : index === 1 ? 0.28 : 0.62,
        upperGroundMotion: index === 0 ? 0.9 : index === 1 ? 1.45 : 2.2,
        basis: index === 0
          ? "Covers the intervals producing most mean seismic risk."
          : index === 1
            ? "Challenges nonlinear response and upper-tail fragility sensitivity."
            : "Confirms response behavior through the terminal risk-significant hazard interval.",
      },
      riskDominantInputLevel: index === 0 ? (kind === "sfr" ? 0.58 : 0.51) : undefined,
      selectionMethod: "Selected from the site uniform-hazard spectra using the shared motion definition, control point, and three-component time-history criteria.",
      selectionValidation: "Component spectra, duration, energy content, inter-component correlation, and scaled median response are consistent with the target spectrum.",
      nonlinearBehaviorBasis: index === 0
        ? "Median-centered response is essentially linear; nonlinear sensitivities are carried for gaps and foundation uplift."
        : "Stiffness degradation, gapping, uplift, and potential structure interaction are explicitly sampled or bounded.",
      implementsSrs: srs("SFR-B1", "SFR-B2", "SFR-B4"),
    }));

  const directions = ["X", "Y", "Z"] as const;
  const responseResults: ResponseAnalysis["responseResults"] =
    models.flatMap((model) => {
      const modelId = model.uuid.replace("STRUCTURAL-MODEL-", "") as EquipmentTemplate["responseModel"];
      const locations: Record<EquipmentTemplate["responseModel"], string> = {
        RB: kind === "sfr"
          ? "Reactor building operating deck"
          : "Reactor building module service level",
        SUPPORT: kind === "sfr"
          ? "Sodium-service equipment gallery"
          : "Helium-service equipment floor",
        DHR: kind === "sfr"
          ? "Decay-heat-removal air-cooler deck"
          : "RCCS intake support elevation",
        CONTROL: "Protection and electrical equipment floor",
      };
      return directions.map((direction, directionIndex) => ({
        uuid: modelId === "RB" && direction === "X"
          ? "RESPONSE-PRIMARY-LOCATION"
          : `RESPONSE-${modelId}-${direction}`,
        name: `${locations[modelId]} ${direction}-direction median FRS`,
        responseModelRef: model.uuid,
        referenceEarthquakeRef: "REFERENCE-EQ-1",
        location: locations[modelId],
        responseQuantity: "FLOOR_RESPONSE_SPECTRUM" as const,
        direction,
        units: "g",
        spectrumPoints: spectrum(kind, modelId, direction),
        betaRandomness: Number((0.21 + directionIndex * 0.015 + (modelId === "DHR" ? 0.025 : 0)).toFixed(3)),
        betaUncertainty: Number((0.27 + directionIndex * 0.02 + (modelId === "SUPPORT" ? 0.02 : 0)).toFixed(3)),
        compositeBeta: Number(Math.sqrt(
          (0.21 + directionIndex * 0.015 + (modelId === "DHR" ? 0.025 : 0)) ** 2
          + (0.27 + directionIndex * 0.02 + (modelId === "SUPPORT" ? 0.02 : 0)) ** 2,
        ).toFixed(4)),
        variabilityBasis: "Aleatory input-motion and damping variability are separated from epistemic soil, stiffness, mass, damping, and model-form uncertainty with within-structure correlation preserved.",
        applicableSscRefs: responseGroups.get(modelId) ?? [],
        outputFileRef: `${prefix}-FRS-${modelId}-${direction}-R4.H5`,
        implementsSrs: srs("SFR-B1", "SFR-B3", "SFR-B4", "SFR-B5"),
      }));
    });

  const soilStructureInteractionAnalyses:
    ResponseAnalysis["soilStructureInteractionAnalyses"] = models.map((model) => ({
      uuid: `SSI-${model.uuid.replace("STRUCTURAL-MODEL-", "")}`,
      name: `${model.name} SSI analysis`,
      applicable: true,
      significanceAssessment: model.uuid === "STRUCTURAL-MODEL-DHR"
        ? "SSI and localized profile variability shift the first mode and materially affect lower-frequency response."
        : "Foundation flexibility, rocking, embedment, and shared-soil effects materially affect median response or uncertainty.",
      analysisType: "PROBABILISTIC",
      method: "Frequency-domain substructure SSI with complex, frequency-dependent impedance",
      siteSpecific: true,
      soilProfileRefs: ["PROFILE-LOW", "PROFILE-BEST", "PROFILE-HIGH"],
      strainCompatibleProperties: true,
      propertyDistributions: {
        shearWaveVelocityScale: { type: DistributionType.LOGNORMAL, median: 1, errorFactor: 1.35 },
        materialDampingRatio: { type: DistributionType.LOGNORMAL, median: 0.045, errorFactor: 1.3 },
      },
      embedmentTreatment: "Basemat and sidewall contact are modeled with depth-varying impedance and gapping sensitivity.",
      groundMotionIncoherenceTreatment: "Wave-passage and spatial incoherence are applied to embedded and extended foundations.",
      structureSoilStructureInteractionTreatment: "Common-soil impedance preserves coupling for adjacent structures where separation is small.",
      medianResponseResultRefs: responseResults
        .filter((result) => result.responseModelRef === model.uuid)
        .map((result) => result.uuid),
      uncertaintyResultRefs: responseResults
        .filter((result) => result.responseModelRef === model.uuid)
        .map((result) => result.uuid),
      exclusionOrMethodBasis: "Site-specific SSI is retained because strain-compatible profile branches overlap the dominant structural frequencies.",
      implementsSrs: srs("SFR-B3", "SFR-B5"),
    }));

  const simulationConfigurations: {
    id: string;
    name: string;
    count: number;
    motionSets: number;
    models: EquipmentTemplate["responseModel"][];
  }[] = [
    { id: "RB", name: "Reactor-building probabilistic response", count: 1000, motionSets: 60, models: ["RB"] },
    { id: "SUPPORT", name: "Support-structure probabilistic response", count: 800, motionSets: 48, models: ["SUPPORT", "CONTROL"] },
    { id: "DHR", name: "Decay-heat-removal probabilistic response", count: 900, motionSets: 54, models: ["DHR"] },
  ];
  const probabilisticSimulations:
    ResponseAnalysis["probabilisticSimulations"] =
    simulationConfigurations.map((configuration, index) => ({
      uuid: index === 0 ? "RESPONSE-SIM-1" : `RESPONSE-SIM-${index + 1}`,
      name: configuration.name,
      method: "LATIN_HYPERCUBE",
      simulationCount: configuration.count,
      randomSeed: 19421 + index * 3107,
      inputMotionSetCount: configuration.motionSets,
      componentsPerSet: 3,
      sampledAleatoryVariables: [
        "three-component input-motion record",
        "material damping",
        "equipment mass realization",
      ],
      sampledEpistemicVariables: [
        "soil profile branch",
        "strain-compatible soil modulus",
        "structural stiffness",
        "model-form bias",
        "SSI impedance",
      ],
      correlationTreatment: "Within-structure stiffness, damping, soil, and common-input correlations are preserved; independent capacity terms are not introduced into response.",
      convergenceMetric: "Maximum relative change in median and logarithmic standard deviation at risk-significant spectral peaks.",
      convergenceCriterion: "Less than two-percent change over the final 200 simulations and no directional ordinate above three percent.",
      convergenceResults: [100, 200, 400, 600, 800, configuration.count]
        .filter((sampleCount, sampleIndex, values) =>
          sampleCount <= configuration.count
          && values.indexOf(sampleCount) === sampleIndex)
        .map((sampleCount) => ({
          sampleCount,
          metricValue: Number((0.045 * Math.sqrt(100 / sampleCount) + 0.0015).toPrecision(4)),
        })),
      stableResponsesDemonstrated: true,
      outputResultRefs: responseResults
        .filter((result) =>
          configuration.models.some((modelId) =>
            result.responseModelRef === `STRUCTURAL-MODEL-${modelId}`))
        .map((result) => result.uuid),
      implementsSrs: srs("SFR-B4", "SFR-B5", "SFR-B6"),
    }));

  const scalingEvaluations: ResponseAnalysis["scalingEvaluations"] =
    [1, 2].flatMap((targetIndex) => models.map((model) => ({
      uuid: `SCALING-${model.uuid.replace("STRUCTURAL-MODEL-", "")}-${targetIndex + 1}`,
      name: `${model.name} scaling to ${referenceEarthquakes[targetIndex]!.name}`,
      sourceResponseAnalysisRef: responseResults.find((result) =>
        result.responseModelRef === model.uuid)!.uuid,
      targetResponseAnalysisRef: `${model.uuid}-${referenceEarthquakes[targetIndex]!.uuid}`,
      scaleFactor: Number((referenceLevels[targetIndex]! / referenceLevels[0]!).toFixed(3)),
      originalSpectrumRef: "UHS-1E-4-H",
      targetSpectrumRef: spectra[targetIndex]!,
      structuralModelSimilarity: "The same validated three-dimensional structural model is used with response-level stiffness branches.",
      foundationSimilarity: "Foundation geometry is unchanged; strain-compatible soil properties are recalculated for the target motion.",
      inputMotionSimilarity: "Scaled suites satisfy target-spectrum shape, duration, energy, and component-correlation checks.",
      naturalFrequencyAndModeShapeEvaluation: "Frequency shifts and mode-shape changes are tracked for stiffness degradation and SSI nonlinearity.",
      nonlinearPhenomenaEvaluation: "Foundation gapping, uplift, concrete cracking, seismic-gap closure, and support nonlinearities are explicitly evaluated.",
      conservativeForCapabilityCategoryOne: false,
      adequacyJustification: "Median response bias remains within five percent at risk-significant ordinates and upper-tail nonlinear sensitivities bound residual scaling error.",
      implementsSrs: srs("SFR-B2", "SFR-B3", "SFR-B4"),
    })));

  sfr.seismicResponseAnalysis = {
    hazardSpectrumRefs: spectra,
    threeOrthogonalDirectionsUsed: true,
    referenceEarthquakes,
    structuralModels: models,
    scalingEvaluations,
    responseResults,
    soilStructureInteractionAnalyses,
    probabilisticSimulations,
    groundMotionParameterConsistency: "All reference earthquakes and response results use the SHA geometric-mean horizontal spectral acceleration definition, compatible vertical motion, 5-percent damping, and g units.",
    controlPointConsistency: "Foundation input is transferred at CONTROL-POINT-FOUNDATION; structure and floor response locations retain traceable transfer functions and elevations.",
    timeHistoryDevelopmentBasis: "Hazard-consistent three-component suites preserve spectral shape, duration, energy content, inter-component correlation, and record-to-record variability over the hazard range.",
    medianCentered: true,
    approximationBiasAssessment: "Scaling, modal truncation, discretization, and numerical solution biases remain below five percent at risk-significant response ordinates; upper-level nonlinear sensitivities bound residual bias.",
    implementsSrs: srs("SFR-B1", "SFR-B2", "SFR-B3", "SFR-B4", "SFR-B5", "SFR-B6"),
  };

  const responseBySsc = new Map<string, string>();
  for (const result of responseResults) {
    for (const sscRef of result.applicableSscRefs) {
      if (!responseBySsc.has(sscRef) && result.direction === "X") {
        responseBySsc.set(sscRef, result.uuid);
      }
    }
  }
  sfr.results.fragilityEvaluations = sfr.results.fragilityEvaluations.map((fragility) => ({
    ...fragility,
    responseResultRefs: [responseBySsc.get(fragility.sscRef) ?? "RESPONSE-PRIMARY-LOCATION"],
  }));
  sfr.results.failureMechanisms = sfr.results.failureMechanisms.map((mechanism) => ({
    ...mechanism,
    demandResultRefs: [
      responseBySsc.get(mechanism.sscRef) ?? "RESPONSE-PRIMARY-LOCATION",
      ...mechanism.demandResultRefs.filter((reference) =>
        reference === "LIQUEFACTION-HAZARD-RESULTS"),
    ],
  }));
  sfr.results.correlationGroups = sfr.results.correlationGroups.map((group) =>
    group.uuid === "CORR-COLOCATED-EQUIPMENT"
      ? { ...group, memberSscRefs: activeRefs }
      : group);

  return entries;
}

export { populateSelAndResponse };
