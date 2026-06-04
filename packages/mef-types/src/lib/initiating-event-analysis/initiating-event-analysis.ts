import { Named, Unique } from "../core/meta";
import { Frequency, InitiatingEvent, BaseEvent, FrequencyUnit } from "../core/events";
import {
  IdPatterns,
  ImportanceLevel,
  SensitivityStudy,
  ScreeningStatus,
  ScreeningCriteria,
  SuccessCriteriaId,
} from "../core/shared-patterns";
import {
  OperatingState,
  BarrierStatus,
  ModuleState,
  SafetyFunction,
  RadionuclideBarrier,
  PlantOperatingState,
} from "../plant-operating-states-analysis/plant-operating-states-analysis";
import {
  Uncertainty,
  DataSource,
  Assumption,
  DistributionType,
  FrequencyQuantification,
  BayesianUpdate,
} from "../data-analysis/data-analysis";
import { BaseAssumption } from "../core/documentation";
import { ComponentReference } from "../core/component";
import { TechnicalElement, TechnicalElementTypes, TechnicalElementMetadata } from "../technical-element";
import { SystemDefinition, FailureModeType } from "../systems-analysis/systems-analysis";
import { VersionInfo, SCHEMA_VERSION, createVersionInfo } from "../core/version";
export type PlantOperatingStateReference = string;
export type SafetyFunctionReference = string;
export enum InitiatingEventCategory {
  TRANSIENT = "TRANSIENT",
  RCB_BREACH = "RCB_BREACH",
  INTERFACING_SYSTEMS_RCB_BREACH = "INTERFACING_SYSTEMS_RCB_BREACH",
  SPECIAL = "SPECIAL",
  INTERNAL_HAZARD = "INTERNAL_HAZARD",
  EXTERNAL_HAZARD = "EXTERNAL_HAZARD",
  HUMAN_FAILURE = "HUMAN_FAILURE",
}
export interface ExtendedInitiatingEvent extends InitiatingEvent {
  category: InitiatingEventCategory | string;
  description?: string;
  uncertainty?: Uncertainty;
  group?: string;
  applicableStates?: PlantOperatingStateReference[];
  groupId?: string;
  plantExperience?: string[];
  genericAnalysisReview?: string;
  preOperationalAssumptions?: string[];
  screeningBasis?: string;
  supportingAnalyses?: {
    analysisType: string;
    analysisId: string;
    description?: string;
  }[];
  screeningStatus?: ScreeningStatus;
  importanceLevel?: ImportanceLevel;
}
export interface IdentificationMethodBase {
  method_id: string;
  version: string;
  analyst: string;
  review_date: string;
  review_status: "DRAFT" | "REVIEWED" | "APPROVED";
  supporting_documents: string[];
}
export interface MasterLogicDiagram extends IdentificationMethodBase {
  sources: Set<string>;
  operating_states: Set<OperatingState>;
  radionuclide_barriers: Record<string, RadionuclideBarrier>;
  safety_functions: Record<string, SafetyFunction>;
  systems_components: Record<string, SystemDefinition>;
  failure_modes: Record<
    string,
    {
      id: string;
      name: string;
      description: string;
      component_id: string;
      failureMode: FailureModeType | string;
    }
  >;
  initiators: Record<string, InitiatorDefinition>;
}
export interface HeatBalanceFaultTree extends IdentificationMethodBase {
  operating_states: Set<OperatingState>;
  interfaces: Record<
    string,
    {
      name: string;
      parameters: string[];
      normal_ranges: [number, number][];
    }
  >;
  imbalances: Record<
    string,
    {
      description: string;
      threshold: number;
      consequences: string[];
    }
  >;
  causes: Record<
    string,
    {
      description: string;
      probability: number;
      uncertainty?: Uncertainty;
    }
  >;
  systems_components: Record<string, SystemDefinition>;
}
export interface FailureModesEffectAnalysis extends IdentificationMethodBase {
  systems: Record<
    string,
    {
      name: string;
      function: string;
      boundaries: string[];
    }
  >;
  components: Record<string, SystemDefinition>;
  failure_modes: Record<
    string,
    {
      mode: FailureModeType | string;
      causes: string[];
      local_effects: string[];
      system_effects: string[];
      detection: string[];
      safeguards: string[];
      severity: number;
      probability: number;
    }
  >;
}
export interface InitiatorDefinition extends ExtendedInitiatingEvent {
  id: string;
  subcategory?: string;
  identification_method: string;
  identification_basis: string[];
  operating_states: OperatingState[];
  trip_parameters: Record<
    string,
    {
      parameter: string;
      setpoint: number;
      uncertainty: number;
      basis: string;
    }
  >;
  mitigating_systems: Record<
    string,
    {
      system: string;
      function: string;
      success_criteria: string | string[] | SuccessCriteriaId;
      dependencies: string[];
    }
  >;
  barrier_impacts: Record<
    string,
    {
      barrier: string;
      state: BarrierStatus;
      timing: string;
      mechanism: string;
    }
  >;
  module_impacts: Record<
    string,
    {
      module: string;
      state: ModuleState;
      propagation_path?: string;
      timing?: string;
    }
  >;
}
export interface HazardInducedInitiator extends InitiatorDefinition {
  hazard_type: string;
  hazard_severity: string;
  combined_hazards?: string[];
  affected_areas: string[];
  hazard_frequency_factors: {
    return_period?: number;
    exceedance_probability?: number;
    fragility_parameters?: Record<string, number>;
  };
}
export interface InitiatingEventScreeningCriteria extends ScreeningCriteria {
  screened_out_events: {
    event_id: string;
    reason: string;
    justification: string;
  }[];
}
export interface InitiatingEventGroup extends Unique, Named {
  description: string;
  member_ids: string[];
  grouping_basis: string;
  bounding_initiator_id: string;
  shared_mitigation_requirements: string[];
  challenged_safety_functions: SafetyFunctionReference[];
  applicable_operating_states: PlantOperatingStateReference[];
  quantification?: FrequencyQuantification;
  risk_importance?: ImportanceLevel;
}
export interface InitiatingEventQuantification {
  event_id: string;
  quantification: FrequencyQuantification;
  data_exclusion_justification?: string;
  other_reactor_data_justification?: string;
  fault_tree_details?: {
    model_id: string;
    top_event: string;
    modifications: string[];
  };
  sensitivityStudies?: SensitivityStudy[];
}
export interface InitiatingEventDocumentation {
  processDescription: string;
  inputSources: string[];
  appliedMethods: string[];
  resultsSummary: string;
  functionalCategories: string[];
  plantUniqueInitiatorsSearch: string;
  stateSpecificInitiatorsSearch: string;
  rcbFailureSearch: string;
  completenessAssessment: string;
  screeningBasis: string;
  groupingBasis: string;
  dismissalJustification: string;
  frequencyDerivation: string;
  quantificationApproach: string;
  dataExclusionJustification: string;
  otherDataApplicationJustification: string;
}
export interface PeerReviewDocumentation extends Unique, Named {
  reviewDate: string;
  reviewTeam: string[];
  findings: {
    id: string;
    description: string;
    significance: "HIGH" | "MEDIUM" | "LOW";
    associatedRequirements: string[];
    status: "OPEN" | "CLOSED" | "IN_PROGRESS";
    resolutionPlan?: string;
    resolutionDate?: string;
  }[];
  scope: string;
  methodology: string;
  reportReference: string;
}
export interface PreOperationalAssumptions {
  statement: string;
  impact: string;
  treatmentApproach: string;
  validationPlan?: string;
}
export interface InitiatingEventsAnalysis extends TechnicalElement<TechnicalElementTypes.INITIATING_EVENT_ANALYSIS> {
  additionalMetadata?: {
    assumptions: Assumption[];
  };
  applicable_plant_operating_states: PlantOperatingStateReference[];
  identification: {
    master_logic_diagram: MasterLogicDiagram;
    heat_balance_fault_tree: HeatBalanceFaultTree;
    failure_modes_analysis: FailureModesEffectAnalysis;
  };
  initiators: Record<string, InitiatorDefinition>;
  initiating_event_groups: Record<string, InitiatingEventGroup>;
  quantification: Record<string, InitiatingEventQuantification>;
  screening_criteria: InitiatingEventScreeningCriteria;
  insights: {
    key_assumptions: string[];
    sensitivityStudies: Record<string, SensitivityStudy>;
    dominant_contributors: string[];
    uncertainty_drivers: string[];
  };
  documentation?: InitiatingEventDocumentation;
  peer_review?: PeerReviewDocumentation;
  pre_operational_assumptions?: PreOperationalAssumptions[];
}
export interface HazardAnalysis extends Unique, Named {
  description: string;
  hazard_type: "INTERNAL" | "EXTERNAL";
  subcategory: string;
  severity_levels: string[];
  affected_areas: string[];
  radionuclide_barriers: Record<string, RadionuclideBarrier>;
  inducing_mechanisms: string[];
  induced_initiating_events: string[];
  potential_combinations: string[];
  analysis_methods: string[];
  screening: {
    status: ScreeningStatus;
    basis: string;
  };
}
export const validateInitiatingEventsAnalysis = {
  validateFrequency: (event: InitiatorDefinition): string[] => {
    const errors: string[] = [];
    const frequencyValue = typeof event.frequency === "number" ? event.frequency : event.frequency.value;
    if (frequencyValue < 0) {
      errors.push(`Initiating event frequency for ${event.name} (${event.id}) cannot be negative.`);
    }
    return errors;
  },
  validateGroupConsistency: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    Object.entries(analysis.initiating_event_groups).forEach(([groupId, group]) => {
      for (const memberId of group.member_ids) {
        if (!(memberId in analysis.initiators)) {
          errors.push(`Group ${groupId} references non-existent initiator ${memberId}`);
        }
      }
      if (!(group.bounding_initiator_id in analysis.initiators)) {
        errors.push(`Group ${groupId} has non-existent bounding initiator ${group.bounding_initiator_id}`);
      } else if (!group.member_ids.includes(group.bounding_initiator_id)) {
        errors.push(`Bounding initiator ${group.bounding_initiator_id} is not a member of group ${groupId}`);
      }
    });
    return errors;
  },
  validateOperatingStates: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    Object.entries(analysis.initiators).forEach(([id, initiator]) => {
      if (initiator.operating_states.length === 0) {
        errors.push(`Initiator ${id} has no operating states defined`);
      }
    });
    return errors;
  },
  validateApplicableStates: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    Object.entries(analysis.initiators).forEach(([id, initiator]) => {
      if (initiator.applicableStates) {
        for (const stateId of initiator.applicableStates) {
          if (!analysis.applicable_plant_operating_states.includes(stateId)) {
            errors.push(`Initiator ${id} references non-applicable plant operating state ${stateId}`);
          }
        }
      }
    });
    return errors;
  },
  validateScreening: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    for (const screenedEvent of analysis.screening_criteria.screened_out_events) {
      if (!screenedEvent.justification) {
        errors.push(`Screened out event ${screenedEvent.event_id} has no justification`);
      }
      if (!(screenedEvent.event_id in analysis.initiators)) {
        errors.push(`Screened out event ${screenedEvent.event_id} is not defined in initiators`);
      }
    }
    return errors;
  },
  validateCompleteness: (analysis: InitiatingEventsAnalysis): string[] => {
    const errors: string[] = [];
    const categories = new Set(Object.values(analysis.initiators).map((ie) => ie.category));
    const requiredCategories = [
      InitiatingEventCategory.TRANSIENT,
      InitiatingEventCategory.RCB_BREACH,
      InitiatingEventCategory.INTERFACING_SYSTEMS_RCB_BREACH,
    ];
    for (const requiredCategory of requiredCategories) {
      if (!categories.has(requiredCategory)) {
        errors.push(`Required initiating event category ${requiredCategory} is not represented`);
      }
    }
    return errors;
  },
};
