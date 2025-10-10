// Local proxy for EventSequenceToReleaseCategory (replace with import if available)
export interface EventSequenceToReleaseCategory extends Unique {
    eventSequenceId: string;
    releaseCategoryId: string;
    mappingBasis?: string;
}
// Local proxy types for build-unblocking. Replace with imports if/when available in shared-types.
export interface SensitivityStudy { name?: string; description: string; variedParameters: string[]; parameterRanges: Record<string, [number, number]>; results?: string; insights?: string; impact?: string; modelUncertaintyId?: string; elementSpecificProperties?: Record<string, unknown>; }
// Local proxy types for build-unblocking. Replace with imports if/when available in shared-types.
export type RiskSignificanceCriteriaReference = string;
export enum ImportanceLevel { HIGH = "HIGH", MEDIUM = "MEDIUM", LOW = "LOW" }
export enum RiskMetricType { INDIVIDUAL_EARLY_FATALITY_RISK = "INDIVIDUAL_EARLY_FATALITY_RISK", INDIVIDUAL_LATENT_CANCER_FATALITY_RISK = "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", POPULATION_DOSE = "POPULATION_DOSE", LAND_CONTAMINATION_AREA = "LAND_CONTAMINATION_AREA", ECONOMIC_COST = "ECONOMIC_COST", CUSTOM = "CUSTOM" }
export enum RiskSignificanceCriteriaType { QHO = "QHO", SAFETY_GOAL = "SAFETY_GOAL", DESIGN_OBJECTIVE = "DESIGN_OBJECTIVE", OTHER = "OTHER" }
export enum FrequencyUnit { PER_REACTOR_YEAR = "per-reactor-year", PER_CALENDAR_YEAR = "per-calendar-year", PER_CRITICAL_YEAR = "per-critical-year" }
export interface Uncertainty { distribution: string; parameters: Record<string, number>; }
export interface Assumption { context?: string; impactedParameters?: string[]; closureCriteria?: string; }
export type DistributionType = string;
export interface Named { name: string; description?: string; }
export interface Unique { uuid: string; }
export enum TechnicalElementTypes { RISK_INTEGRATION = "risk-integration" }
export interface TechnicalElement<T> extends Unique, Named { type: T; version: string; created: string; modified: string; }

// Copied from openpra-mef/technical-elements/risk-integration/risk-integration.ts

export interface RiskMetric extends Unique, Named {
    metricType: RiskMetricType | string;
    description?: string;
    value: number;
    units: FrequencyUnit | string;
    uncertainty?: Uncertainty;
    acceptanceCriteria?: {
        limit: number;
        basis: string;
        complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "INDETERMINATE";
    };
}

export interface RiskContributor extends Unique, Named {
    contributorType: string;
    sourceElement: TechnicalElementTypes;
    sourceId: string;
    importanceMetrics?: {
        fussellVesely?: number;
        raw?: number;
        rrw?: number;
        birnbaum?: number;
        [key: string]: number | undefined;
    };
    riskContribution?: number;
    importanceLevel?: ImportanceLevel;
    context?: string;
    insights?: string[];
}

export interface RiskSignificanceCriteria extends Unique, Named {
    description?: string;
    criteriaType: RiskSignificanceCriteriaType | string;
    metricType: RiskMetricType | string;
    absoluteThresholds?: {
        eventSequence?: number;
        eventSequenceFamily?: number;
        basic?: number;
        humanFailure?: number;
        component?: number;
        system?: number;
        [key: string]: number | undefined;
    };
    relativeThresholds?: {
        eventSequence?: number;
        eventSequenceFamily?: number;
        basic?: number;
        humanFailure?: number;
        component?: number;
        system?: number;
        [key: string]: number | undefined;
    };
    justification: string;
    minimumReportingConsequence?: string;
    references?: string[];
    intendedApplications?: string[];
}

export interface RiskSignificanceEvaluation extends Unique {
    elementType: string;
    elementId: string;
    criteriaReference: RiskSignificanceCriteriaReference;
    evaluationResults: {
        absoluteValue?: number;
        relativeValue?: number;
        isSignificant: boolean;
        significanceBasis: string;
    };
    insights?: string[];
}

export interface IntegratedRiskResults extends Unique, Named {
    description?: string;
    metrics: RiskMetric[];
    integrationChallenges?: string;
}

export interface SignificantRiskContributors extends Unique {
    metricType: RiskMetricType | string;
    significantEventSequences?: RiskContributor[];
    significantSystems?: RiskContributor[];
    significantComponents?: RiskContributor[];
    significantBasicEvents?: RiskContributor[];
    significantPlantOperatingStates?: RiskContributor[];
    significantHazardGroups?: RiskContributor[];
    significantRadioactiveSources?: RiskContributor[];
    insights?: string[];
    screeningCriteria?: {
        criteriaType: string;
        threshold: number;
        basis: string;
    };
}

export interface ModelUncertaintySource extends Unique, Named {
    description: string;
    originatingElement: TechnicalElementTypes;
    impactScope: TechnicalElementTypes[];
    affectedMetrics: (RiskMetricType | string)[];
    impactAssessment: string;
    characterizationMethod?: string;
    relatedAssumptions?: string[];
    alternatives?: {
        description: string;
        potentialImpact: string;
    }[];
    recommendations?: string[];
}

export interface RiskUncertaintyAnalysis extends Unique, Named {
    description?: string;
    metric: RiskMetricType | string;
    propagationMethod: string;
    parameterUncertainty?: {
        distribution: DistributionType;
        parameters: Record<string, number>;
    };
    keyUncertaintySources?: ModelUncertaintySource[];
    relatedAssumptions?: Assumption[];
    prioritization?: {
        uncertaintySourceId: string;
        priorityLevel: ImportanceLevel;
        basis: string;
    }[];
    sensitivityStudies?: SensitivityStudy[];
    uncertaintyRangeDiscussion?: string;
    deterministicComparison?: string;
    keyUncertaintyContributors?: {
        sourceId: string;
        sourceName: string;
        contribution: string | number;
        basis: string;
        potentialImpactRange?: {
            lowerBound: number;
            upperBound: number;
            unit?: string;
        };
        recommendedActions?: string[];
        priority?: ImportanceLevel;
    }[];
    keyContributorIdentificationMethod?: {
        description: string;
        significanceCriteria: string;
        justification: string;
    };
}

export interface RiskIntegrationAssumption extends Unique {
    description: string;
    originatingElement: TechnicalElementTypes;
    basis: string;
    impact: string;
    alternatives?: string[];
}

export interface RiskIntegrationDocumentation extends Unique {
    description: string;
    references?: string[];
}

export interface RiskIntegration extends TechnicalElement<TechnicalElementTypes.RISK_INTEGRATION> {
    description: string;
    assumptions?: RiskIntegrationAssumption[];
    documentation?: RiskIntegrationDocumentation;
}

export {};
