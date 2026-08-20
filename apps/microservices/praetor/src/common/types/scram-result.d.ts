export interface RuntimeSummary {
    analysisSeconds?: number;
    totalSeconds?: number;
}
export interface CutSetStats {
    originalProducts?: number;
    products?: number;
    exactProbability?: number;
    approximateProbability?: number;
    relativeError?: number;
}
export interface ScramSequence {
    name: string;
    probability?: number;
    events?: string[];
    products?: number;
    originalProducts?: number;
    exactProbability?: number;
    'exact-probability'?: number;
    approximateProbability?: number;
    relativeError?: number;
    adaptiveTarget?: number;
    value?: number;
    cutSets?: CutSetStats;
}
export interface ScramInitiatingEvent {
    name: string;
    description?: string;
    sequences: ScramSequence[];
}
export interface ScramResult {
    modelFeatures: Record<string, string | number | boolean>;
    runtimeSummary?: RuntimeSummary;
    results: {
        initiatingEvents: ScramInitiatingEvent[];
        sumOfProducts: ScramSequence[];
        runtimeSummary?: RuntimeSummary;
    };
}
