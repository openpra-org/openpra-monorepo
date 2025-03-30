/**
 * @packageDocumentation
 * @module technical_elements.core.integration
 * @description SAPHIRE compatibility annotations for OpenPRA
 * @annotation Required for SAPHIRE model type differentiation (MTD format)
 * @group SAPHIRE
 */

/**
 * Represents a mapping between OpenPRA fields and SAPHIRE fields
 * @memberof technical_elements.core.integration
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
    description: "Component ID template flag"
  },
  {
    openPraField: "templateUseFlags.system",
    saphireField: "template_system",
    description: "System template flag"
  },
  {
    openPraField: "templateUseFlags.train",
    saphireField: "template_train",
    description: "Train template flag"
  },
  {
    openPraField: "templateUseFlags.type",
    saphireField: "template_type",
    description: "Type template flag"
  },
  {
    openPraField: "templateUseFlags.failureMode",
    saphireField: "template_failure_mode",
    description: "Failure mode template flag"
  },
  {
    openPraField: "templateUseFlags.location",
    saphireField: "template_location",
    description: "Location template flag"
  },
  {
    openPraField: "templateUseFlags.eventType",
    saphireField: "template_event_type",
    description: "Event type template flag"
  },
  {
    openPraField: "templateUseFlags.description",
    saphireField: "template_description",
    description: "Description template flag"
  },
  {
    openPraField: "templateUseFlags.models",
    saphireField: "template_models",
    description: "Models template flag"
  },
  {
    openPraField: "templateUseFlags.phases",
    saphireField: "template_phases",
    description: "Phases template flag"
  },
  {
    openPraField: "templateUseFlags.notes",
    saphireField: "template_notes",
    description: "Notes template flag"
  },
  {
    openPraField: "templateUseFlags.references",
    saphireField: "template_references",
    description: "References template flag"
  },
  {
    openPraField: "templateUseFlags.categories",
    saphireField: "template_categories",
    description: "Categories template flags"
  }
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
    description: "Numerical identifier for the model type"
  },
  {
    openPraField: "name",
    saphireField: "type_name",
    description: "Name of the model type"
  },
  {
    openPraField: "suffix",
    saphireField: "type_suffix",
    description: "Suffix used in SAPHIRE for the model type"
  },
  {
    openPraField: "color",
    saphireField: "type_color",
    description: "Color code for visualization in SAPHIRE"
  }
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
    namespace: 'systems_analysis' | 'plant_operating_states_analysis' | 'mechanistic_source_term' | 'event_sequence_analysis';
    
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
    description: "Numerical identifier for the phase"
  },
  {
    openPraField: "name",
    saphireField: "phase_name",
    description: "Name of the phase"
  },
  {
    openPraField: "order",
    saphireField: "phase_order",
    description: "Order of the phase in the sequence"
  },
  {
    openPraField: "suffix",
    saphireField: "phase_suffix",
    description: "Suffix used in SAPHIRE for the phase"
  },
  {
    openPraField: "color",
    saphireField: "phase_color",
    description: "Color code for visualization in SAPHIRE"
  },
  {
    openPraField: "technicalElementReference.elementType",
    saphireField: "phase_element_type",
    description: "Type of technical element this phase maps to"
  },
  {
    openPraField: "technicalElementReference.elementId",
    saphireField: "phase_element_id",
    description: "ID of the technical element this phase maps to"
  },
  {
    openPraField: "technicalElementReference.mappingDescription",
    saphireField: "phase_mapping_desc",
    description: "Description of how this phase relates to the technical element"
  }
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
    description: "Value for PASS events in SAPHIRE"
  },
  {
    openPraField: "initiatingEventRef",
    saphireField: "init_event_ref",
    description: "Reference to initiating event for INIT events"
  }
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
    description: "Mission time in hours"
  },
  {
    openPraField: "newSum",
    saphireField: "new_sum",
    description: "New sum identifier"
  },
  {
    openPraField: "company",
    saphireField: "company",
    description: "Company name"
  },
  {
    openPraField: "location",
    saphireField: "location",
    description: "Project location"
  },
  {
    openPraField: "type",
    saphireField: "type",
    description: "Project type"
  },
  {
    openPraField: "design",
    saphireField: "design",
    description: "Design information"
  },
  {
    openPraField: "vendor",
    saphireField: "vendor",
    description: "Vendor information"
  },
  {
    openPraField: "architectEngineer",
    saphireField: "architect_engineer",
    description: "Architect/Engineer information"
  },
  {
    openPraField: "operationDate",
    saphireField: "operation_date",
    description: "Operation date (YYYY/MM/DD)"
  },
  {
    openPraField: "qualificationDate",
    saphireField: "qualification_date",
    description: "Qualification date (YYYY/MM/DD)"
  },
  {
    openPraField: "alternateName",
    saphireField: "alternate_name",
    description: "Alternate project name"
  },
  {
    openPraField: "analystInfo",
    saphireField: "analyst_info",
    description: "Analyst information"
  }
];
