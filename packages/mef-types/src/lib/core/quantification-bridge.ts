export interface QuantificationReference {
  id: string;
  systemBasicEventId?: string;
  dataAnalysisReference?: string;
  referenceType: "direct" | "template-based" | "component-based" | "custom";
  quantificationMethod?: "point-estimate" | "distribution" | "bayesian" | "maximum-likelihood" | string;
  metadata?: Record<string, any>;
}
export interface QuantificationReferenceRegistry {
  references: Record<string, QuantificationReference>;
  systemToReference: Record<string, string>;
  dataToReference: Record<string, string>;
}
export enum QuantificationDirection {
  SYSTEM_TO_DATA = "SYSTEM_TO_DATA",
  DATA_TO_SYSTEM = "DATA_TO_SYSTEM",
  BIDIRECTIONAL = "BIDIRECTIONAL",
}
export interface QuantificationWorkflowConfig {
  primaryDirection: QuantificationDirection;
  validateReferences?: boolean;
  missingReferenceHandling?: "error" | "warn" | "ignore";
  enableCaching?: boolean;
  hooks?: {
    beforeQuantification?: Function;
    afterQuantification?: Function;
  };
}
export class QuantificationReferenceManager {
  static createReference(
    systemBasicEventId: string,
    dataAnalysisReference?: string,
    options?: {
      referenceType?: "direct" | "template-based" | "component-based" | "custom";
      quantificationMethod?: string;
      metadata?: Record<string, any>;
    },
  ): QuantificationReference {
    return {
      id: `quant_ref_${systemBasicEventId}`,
      systemBasicEventId,
      dataAnalysisReference,
      referenceType: options?.referenceType ?? "direct",
      quantificationMethod: options?.quantificationMethod,
      metadata: options?.metadata,
    };
  }
  static resolveReference(reference: QuantificationReference): any {
    return null;
  }
  static createRegistry(): QuantificationReferenceRegistry {
    return {
      references: {},
      systemToReference: {},
      dataToReference: {},
    };
  }
  static addToRegistry(
    registry: QuantificationReferenceRegistry,
    reference: QuantificationReference,
  ): QuantificationReferenceRegistry {
    registry.references[reference.id] = reference;
    if (reference.systemBasicEventId) {
      registry.systemToReference[reference.systemBasicEventId] = reference.id;
    }
    if (reference.dataAnalysisReference) {
      registry.dataToReference[reference.dataAnalysisReference] = reference.id;
    }
    return registry;
  }
}
