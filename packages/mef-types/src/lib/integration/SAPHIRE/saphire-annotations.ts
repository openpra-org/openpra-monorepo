/**
 * @packageDocumentation
 * @module technical_elements.integration.SAPHIRE
 * @description SAPHIRE compatibility annotations for OpenPRA
 * @annotation Required for SAPHIRE model type differentiation (MTD format)
 * @group SAPHIRE
 */

/**
 * Represents a mapping between OpenPRA fields and SAPHIRE fields
 * @memberof technical_elements.integration.SAPHIRE
 * @group SAPHIRE
 */
export interface SaphireFieldMapping {
  /** Field name in OpenPRA */
  openPraField: string;

  /** Corresponding field name in SAPHIRE */
  saphireField: string;

  /** Optional description of the mapping */
  description?: string;
}

/**
 * Interface for elements that are compatible with SAPHIRE format
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireCompatible {
  /** Field mappings between OpenPRA and SAPHIRE */
  saphireFieldMappings?: SaphireFieldMapping[];

  /** OpenPSA/SCRAM compatibility mappings */
  openPsaFieldMappings?: Record<string, string>;
}

/**
 * Template use flags for SAPHIRE basic event attributes
 * @memberof technical_elements.core.integration
 * @description Controls which attributes are applied during template-based updates
 * This interface enables:
 * - Standardized component modeling through template flags
 * - Consistent failure mode representation
 * - Systematic event categorization
 * - Efficient bulk updates through templates
 * - Detailed component tracking and documentation
 * - Compatibility with SAPHIRE's BED format
 * @group SAPHIRE
 */
export interface SaphireTemplateUseFlags {
  /** Component identifier template flag */
  componentId: boolean;

  /** System identifier template flag */
  system: boolean;

  /** Train identifier template flag */
  train: boolean;

  /** Type identifier template flag */
  type: boolean;

  /** Failure mode template flag */
  failureMode: boolean;

  /** Location template flag */
  location: boolean;

  /** Event type template flag */
  eventType: boolean;

  /** Description template flag */
  description: boolean;

  /** Models template flag */
  models: boolean;

  /** Phases template flag */
  phases: boolean;

  /** Notes template flag */
  notes: boolean;

  /** References template flag */
  references: boolean;

  /** Categories template flags */
  categories: boolean[];
}

/**
 * Template use flags mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Model type mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE phase compatibility
 * @memberof technical_elements.core.integration
 * Maps SAPHIRE phases to OpenPRA technical elements:
 * - systems_analysis: Maps to temporal phases and component timelines
 * - plant_operating_states_analysis: Maps to operating states
 * - mechanistic_source_term: Maps to release phases
 * - event_sequence_analysis: Maps to intermediate states
 * @group SAPHIRE
 */
export interface SaphirePhase {
  /** Numerical identifier for the phase */
  num: number;

  /** Name of the phase */
  name: string;

  /** Order of the phase in the sequence */
  order: number;

  /** Suffix used in SAPHIRE for the phase */
  suffix: string;

  /** Color code for visualization in SAPHIRE */
  color: number;

  /** Reference to the technical element this phase maps to */
  technicalElementReference?: {
    /** Technical element namespace this phase maps to */
    namespace:
      | "systems_analysis"
      | "plant_operating_states_analysis"
      | "mechanistic_source_term"
      | "event_sequence_analysis";

    /** ID of the technical element */
    elementId: string;

    /** Description of how this phase relates to the technical element */
    mappingDescription?: string;
  };
}

/**
 * Phase mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Field mappings for special events in SAPHIRE
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 * @annotation Required for SAPHIRE special event compatibility
 */
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

/**
 * Interface for SAPHIRE project attributes
 * @memberof technical_elements.core.integration
 * @annotation Required for SAPHIRE project compatibility (FAA format)
 * @group SAPHIRE
 */
export interface SaphireProjectAttributes {
  /** Mission time in hours */
  missionTime: number;

  /** New sum identifier */
  newSum: string;

  /** Company name */
  company: string;

  /** Project location */
  location: string;

  /** Project type */
  type: string;

  /** Design information */
  design: string;

  /** Vendor information */
  vendor: string;

  /** Architect/Engineer information */
  architectEngineer: string;

  /** Operation date (YYYY/MM/DD) */
  operationDate: string;

  /** Qualification date (YYYY/MM/DD) */
  qualificationDate: string;

  /** Alternate project name */
  alternateName: string;

  /** Analyst information */
  analystInfo: string;
}

/**
 * Project attributes mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE fault tree compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireFaultTree {
  /** Fault tree name */
  name: string;

  /** Fault tree description */
  description?: string;

  /** Whether this is a sub-tree */
  subTree?: boolean;

  /** Alternate fault tree name */
  alternateName?: string;

  /** Textual information */
  text?: string;
}

/**
 * Fault tree mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE gate compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireGate {
  /** Gate name */
  name: string;

  /** Gate description */
  description?: string;

  /** Gate attributes */
  attributes: {
    /** Gate type */
    type: "OR" | "AND" | "NOT" | "NOR" | "NAND" | "XOR";
    /** Alternate gate name */
    alternateName?: string;
  };
}

/**
 * Gate mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE event tree compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireEventTree {
  /** Event tree name */
  name: string;

  /** Event tree description */
  description?: string;

  /** Event tree attributes */
  attributes?: {
    /** Initiating event name */
    initiatingEvent?: string;
    /** Alternate event tree name */
    alternateName?: string;
  };

  /** Textual information */
  text?: string;
}

/**
 * Event tree mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE sequence compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireSequence {
  /** Sequence name */
  name: string;

  /** Parent event tree name */
  eventTree: string;

  /** Sequence description */
  description?: string;

  /** Sequence attributes */
  attributes?: {
    /** End state name */
    endState?: string;
    /** Minimal cut set information */
    minCut?: string;
    /** Mission time */
    mission?: number;
    /** Cut set probability */
    proCut?: string;
    /** Sampling information */
    sample?: string;
    /** Random seed */
    seed?: string;
    /** Size information */
    size?: string;
    /** Number of cuts */
    cuts?: string;
    /** Events information */
    events?: string;
    /** Quantification method */
    quantificationMethod?: string;
    /** Alternate sequence name */
    alternateName?: string;
  };
}

/**
 * Sequence mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE basic event compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireBasicEvent {
  /** Basic event name */
  name: string;

  /** Basic event description */
  description?: string;

  /** Alternate description for the basic event */
  alternateDescription?: string;

  /** Basic event attributes */
  attributes?: {
    /** Alternate name */
    altName?: string;
    /** Event type */
    type?: string;
    /** System identifier */
    system?: string;
    /** Failure mode */
    failureMode?: string;
    /** Location identifier */
    location?: string;
    /** Component identifier */
    componentId?: string;
    /** Train identifier */
    train?: string;
    /** Whether the event is a template */
    isTemplate?: boolean;
    /** Template name if used */
    templateName?: string;
  };

  /** Basic event failure information */
  failureInfo?: {
    /** Failure data type */
    calculationType?: number;
    /** Failure probability */
    probability?: number;
    /** Failure rate (per time) */
    lambda?: number;
    /** Time period */
    tau?: number;
    /** Mission time */
    missionTime?: number;
    /** Initiating event flag */
    init?: string;
    /** Calculated probability */
    calcProb?: number;
    /** Analysis type */
    analysisType?: "RANDOM" | "SEISMIC" | "FIRE" | "OTHER";
    /** Phase type */
    phaseType?: string;
  };
}

/**
 * Basic event mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE Common Cause Failure (CCF) compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireCCF {
  /** CCF type */
  type: string;

  /** CCF model name */
  model: string;

  /** Whether the CCF is staggered */
  staggered: boolean;

  /** CCF factors */
  factors: number[];

  /** Names of independent events */
  independentNames?: string[];
}

/**
 * CCF mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE end state compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireEndState {
  /** End state name */
  name: string;

  /** End state description */
  description?: string;

  /** Textual information */
  text?: string;

  /** End state information */
  information?: {
    /** Default quantification method */
    quantificationMethod?: string;
    /** Number of passes */
    passes?: number;
  };
}

/**
 * End state mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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

/**
 * Interface for SAPHIRE histogram compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
export interface SaphireHistogram {
  /** Histogram name */
  name: string;

  /** Histogram description */
  description?: string;

  /** Histogram bins */
  bins: {
    /** Lower bound of the bin */
    lowerBound: number;
    /** Upper bound of the bin */
    upperBound: number;
    /** Count in the bin */
    count: number;
  }[];
}

/**
 * Histogram mappings for SAPHIRE compatibility
 * @memberof technical_elements.core.integration
 * @group SAPHIRE
 */
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
