export interface SaphireFieldMapping {
  openPraField: string;
  saphireField: string;
  description?: string;
}
export interface SaphireCompatible {
  saphireFieldMappings?: SaphireFieldMapping[];
  openPsaFieldMappings?: Record<string, string>;
}
export interface SaphireTemplateUseFlags {
  componentId: boolean;
  system: boolean;
  train: boolean;
  type: boolean;
  failureMode: boolean;
  location: boolean;
  eventType: boolean;
  description: boolean;
  models: boolean;
  phases: boolean;
  notes: boolean;
  references: boolean;
  categories: boolean[];
}
export const templateUseFlagsSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "templateUseFlags.componentId",
    saphireField: "template_component_id",
    description: "Component ID template flag",
  },
  {
    openPraField: "templateUseFlags.system",
    saphireField: "template_system",
    description: "System template flag",
  },
  {
    openPraField: "templateUseFlags.train",
    saphireField: "template_train",
    description: "Train template flag",
  },
  {
    openPraField: "templateUseFlags.type",
    saphireField: "template_type",
    description: "Type template flag",
  },
  {
    openPraField: "templateUseFlags.failureMode",
    saphireField: "template_failure_mode",
    description: "Failure mode template flag",
  },
  {
    openPraField: "templateUseFlags.location",
    saphireField: "template_location",
    description: "Location template flag",
  },
  {
    openPraField: "templateUseFlags.eventType",
    saphireField: "template_event_type",
    description: "Event type template flag",
  },
  {
    openPraField: "templateUseFlags.description",
    saphireField: "template_description",
    description: "Description template flag",
  },
  {
    openPraField: "templateUseFlags.models",
    saphireField: "template_models",
    description: "Models template flag",
  },
  {
    openPraField: "templateUseFlags.phases",
    saphireField: "template_phases",
    description: "Phases template flag",
  },
  {
    openPraField: "templateUseFlags.notes",
    saphireField: "template_notes",
    description: "Notes template flag",
  },
  {
    openPraField: "templateUseFlags.references",
    saphireField: "template_references",
    description: "References template flag",
  },
  {
    openPraField: "templateUseFlags.categories",
    saphireField: "template_categories",
    description: "Categories template flags",
  },
];
export const modelTypeSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "num",
    saphireField: "type_num",
    description: "Numerical identifier for the model type",
  },
  {
    openPraField: "name",
    saphireField: "type_name",
    description: "Name of the model type",
  },
  {
    openPraField: "suffix",
    saphireField: "type_suffix",
    description: "Suffix used in SAPHIRE for the model type",
  },
  {
    openPraField: "color",
    saphireField: "type_color",
    description: "Color code for visualization in SAPHIRE",
  },
];
export interface SaphirePhase {
  num: number;
  name: string;
  order: number;
  suffix: string;
  color: number;
  technicalElementReference?: {
    namespace:
      | "systems_analysis"
      | "plant_operating_states_analysis"
      | "mechanistic_source_term"
      | "event_sequence_analysis";
    elementId: string;
    mappingDescription?: string;
  };
}
export const phaseSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "num",
    saphireField: "phase_num",
    description: "Numerical identifier for the phase",
  },
  {
    openPraField: "name",
    saphireField: "phase_name",
    description: "Name of the phase",
  },
  {
    openPraField: "order",
    saphireField: "phase_order",
    description: "Order of the phase in the sequence",
  },
  {
    openPraField: "suffix",
    saphireField: "phase_suffix",
    description: "Suffix used in SAPHIRE for the phase",
  },
  {
    openPraField: "color",
    saphireField: "phase_color",
    description: "Color code for visualization in SAPHIRE",
  },
  {
    openPraField: "technicalElementReference.elementType",
    saphireField: "phase_element_type",
    description: "Type of technical element this phase maps to",
  },
  {
    openPraField: "technicalElementReference.elementId",
    saphireField: "phase_element_id",
    description: "ID of the technical element this phase maps to",
  },
  {
    openPraField: "technicalElementReference.mappingDescription",
    saphireField: "phase_mapping_desc",
    description: "Description of how this phase relates to the technical element",
  },
];
export const specialEventSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "specialEventValue",
    saphireField: "special_event_value",
    description: "Value for PASS events in SAPHIRE",
  },
  {
    openPraField: "initiatingEventRef",
    saphireField: "init_event_ref",
    description: "Reference to initiating event for INIT events",
  },
];
export interface SaphireProjectAttributes {
  missionTime: number;
  newSum: string;
  company: string;
  location: string;
  type: string;
  design: string;
  vendor: string;
  architectEngineer: string;
  operationDate: string;
  qualificationDate: string;
  alternateName: string;
  analystInfo: string;
}
export const projectAttributesSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "missionTime",
    saphireField: "mission_time",
    description: "Mission time in hours",
  },
  {
    openPraField: "newSum",
    saphireField: "new_sum",
    description: "New sum identifier",
  },
  {
    openPraField: "company",
    saphireField: "company",
    description: "Company name",
  },
  {
    openPraField: "location",
    saphireField: "location",
    description: "Project location",
  },
  {
    openPraField: "type",
    saphireField: "type",
    description: "Project type",
  },
  {
    openPraField: "design",
    saphireField: "design",
    description: "Design information",
  },
  {
    openPraField: "vendor",
    saphireField: "vendor",
    description: "Vendor information",
  },
  {
    openPraField: "architectEngineer",
    saphireField: "architect_engineer",
    description: "Architect/Engineer information",
  },
  {
    openPraField: "operationDate",
    saphireField: "operation_date",
    description: "Operation date (YYYY/MM/DD)",
  },
  {
    openPraField: "qualificationDate",
    saphireField: "qualification_date",
    description: "Qualification date (YYYY/MM/DD)",
  },
  {
    openPraField: "alternateName",
    saphireField: "alternate_name",
    description: "Alternate project name",
  },
  {
    openPraField: "analystInfo",
    saphireField: "analyst_info",
    description: "Analyst information",
  },
];
export interface SaphireFaultTree {
  name: string;
  description?: string;
  subTree?: boolean;
  alternateName?: string;
  text?: string;
}
export const faultTreeSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "ft_name",
    description: "Fault tree name",
  },
  {
    openPraField: "description",
    saphireField: "ft_description",
    description: "Fault tree description",
  },
  {
    openPraField: "subTree",
    saphireField: "ft_subtree",
    description: "Whether this is a sub-tree",
  },
  {
    openPraField: "alternateName",
    saphireField: "ft_alternate_name",
    description: "Alternate fault tree name",
  },
  {
    openPraField: "text",
    saphireField: "ft_text",
    description: "Textual information",
  },
];
export interface SaphireGate {
  name: string;
  description?: string;
  attributes: {
    type: "OR" | "AND" | "NOT" | "NOR" | "NAND" | "XOR";
    alternateName?: string;
  };
}
export const gateSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "gate_name",
    description: "Gate name",
  },
  {
    openPraField: "description",
    saphireField: "gate_description",
    description: "Gate description",
  },
  {
    openPraField: "attributes.type",
    saphireField: "gate_type",
    description: "Gate type",
  },
  {
    openPraField: "attributes.alternateName",
    saphireField: "gate_alternate_name",
    description: "Alternate gate name",
  },
];
export interface SaphireEventTree {
  name: string;
  description?: string;
  attributes?: {
    initiatingEvent?: string;
    alternateName?: string;
  };
  text?: string;
}
export const eventTreeSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "et_name",
    description: "Event tree name",
  },
  {
    openPraField: "description",
    saphireField: "et_description",
    description: "Event tree description",
  },
  {
    openPraField: "attributes.initiatingEvent",
    saphireField: "et_initiating_event",
    description: "Initiating event name",
  },
  {
    openPraField: "attributes.alternateName",
    saphireField: "et_alternate_name",
    description: "Alternate event tree name",
  },
  {
    openPraField: "text",
    saphireField: "et_text",
    description: "Textual information",
  },
];
export interface SaphireSequence {
  name: string;
  eventTree: string;
  description?: string;
  attributes?: {
    endState?: string;
    minCut?: string;
    mission?: number;
    proCut?: string;
    sample?: string;
    seed?: string;
    size?: string;
    cuts?: string;
    events?: string;
    quantificationMethod?: string;
    alternateName?: string;
  };
}
export const sequenceSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "sq_name",
    description: "Sequence name",
  },
  {
    openPraField: "eventTree",
    saphireField: "sq_event_tree",
    description: "Parent event tree name",
  },
  {
    openPraField: "description",
    saphireField: "sq_description",
    description: "Sequence description",
  },
  {
    openPraField: "attributes.endState",
    saphireField: "sq_end_state",
    description: "End state name",
  },
  {
    openPraField: "attributes.minCut",
    saphireField: "sq_min_cut",
    description: "Minimal cut set information",
  },
  {
    openPraField: "attributes.mission",
    saphireField: "sq_mission",
    description: "Mission time",
  },
  {
    openPraField: "attributes.proCut",
    saphireField: "sq_pro_cut",
    description: "Cut set probability",
  },
  {
    openPraField: "attributes.quantificationMethod",
    saphireField: "sq_quantification_method",
    description: "Quantification method",
  },
  {
    openPraField: "attributes.alternateName",
    saphireField: "sq_alternate_name",
    description: "Alternate sequence name",
  },
];
export interface SaphireBasicEvent {
  name: string;
  description?: string;
  alternateDescription?: string;
  attributes?: {
    altName?: string;
    type?: string;
    system?: string;
    failureMode?: string;
    location?: string;
    componentId?: string;
    train?: string;
    isTemplate?: boolean;
    templateName?: string;
  };
  failureInfo?: {
    calculationType?: number;
    probability?: number;
    lambda?: number;
    tau?: number;
    missionTime?: number;
    init?: string;
    calcProb?: number;
    analysisType?: "RANDOM" | "SEISMIC" | "FIRE" | "OTHER";
    phaseType?: string;
  };
}
export const basicEventSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "be_name",
    description: "Basic event name",
  },
  {
    openPraField: "description",
    saphireField: "be_description",
    description: "Basic event description",
  },
  {
    openPraField: "alternateDescription",
    saphireField: "be_alternate_description",
    description: "Alternate description for the basic event",
  },
  {
    openPraField: "attributes.altName",
    saphireField: "be_alt_name",
    description: "Alternate name",
  },
  {
    openPraField: "attributes.type",
    saphireField: "be_type",
    description: "Event type",
  },
  {
    openPraField: "attributes.system",
    saphireField: "be_system",
    description: "System identifier",
  },
  {
    openPraField: "attributes.failureMode",
    saphireField: "be_failure_mode",
    description: "Failure mode",
  },
  {
    openPraField: "attributes.location",
    saphireField: "be_location",
    description: "Location identifier",
  },
  {
    openPraField: "attributes.componentId",
    saphireField: "be_component_id",
    description: "Component identifier",
  },
  {
    openPraField: "attributes.train",
    saphireField: "be_train",
    description: "Train identifier",
  },
  {
    openPraField: "attributes.isTemplate",
    saphireField: "be_is_template",
    description: "Whether the event is a template",
  },
  {
    openPraField: "attributes.templateName",
    saphireField: "be_template_name",
    description: "Template name if used",
  },
  {
    openPraField: "failureInfo.calculationType",
    saphireField: "be_calculation_type",
    description: "Failure data type",
  },
  {
    openPraField: "failureInfo.probability",
    saphireField: "be_probability",
    description: "Failure probability",
  },
  {
    openPraField: "failureInfo.lambda",
    saphireField: "be_lambda",
    description: "Failure rate (per time)",
  },
  {
    openPraField: "failureInfo.tau",
    saphireField: "be_tau",
    description: "Time period",
  },
  {
    openPraField: "failureInfo.missionTime",
    saphireField: "be_mission_time",
    description: "Mission time",
  },
  {
    openPraField: "failureInfo.init",
    saphireField: "be_init",
    description: "Initiating event flag",
  },
  {
    openPraField: "failureInfo.analysisType",
    saphireField: "be_analysis_type",
    description: "Analysis type",
  },
];
export interface SaphireCCF {
  type: string;
  model: string;
  staggered: boolean;
  factors: number[];
  independentNames?: string[];
}
export const ccfSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "type",
    saphireField: "ccf_type",
    description: "CCF type",
  },
  {
    openPraField: "model",
    saphireField: "ccf_model",
    description: "CCF model name",
  },
  {
    openPraField: "staggered",
    saphireField: "ccf_staggered",
    description: "Whether the CCF is staggered",
  },
  {
    openPraField: "factors",
    saphireField: "ccf_factors",
    description: "CCF factors",
  },
  {
    openPraField: "independentNames",
    saphireField: "ccf_independent_names",
    description: "Names of independent events",
  },
];
export interface SaphireEndState {
  name: string;
  description?: string;
  text?: string;
  information?: {
    quantificationMethod?: string;
    passes?: number;
  };
}
export const endStateSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "es_name",
    description: "End state name",
  },
  {
    openPraField: "description",
    saphireField: "es_description",
    description: "End state description",
  },
  {
    openPraField: "text",
    saphireField: "es_text",
    description: "Textual information",
  },
  {
    openPraField: "information.quantificationMethod",
    saphireField: "es_quantification_method",
    description: "Default quantification method",
  },
  {
    openPraField: "information.passes",
    saphireField: "es_passes",
    description: "Number of passes",
  },
];
export interface SaphireHistogram {
  name: string;
  description?: string;
  bins: {
    lowerBound: number;
    upperBound: number;
    count: number;
  }[];
}
export const histogramSaphireMappings: SaphireFieldMapping[] = [
  {
    openPraField: "name",
    saphireField: "hist_name",
    description: "Histogram name",
  },
  {
    openPraField: "description",
    saphireField: "hist_description",
    description: "Histogram description",
  },
  {
    openPraField: "bins",
    saphireField: "hist_bins",
    description: "Histogram bins",
  },
];
