class Engine {
    BBNSolver: number;
    orderingRule: number;
    BDDConstructor: number;
}

class Sampling {
    method?: string;
    numberOfSamples?: number;
    confidenceInterval?: number;
}

class Importance {
    events?: string;
    measures?: string[];
}

class Quantify {
    treeId: number;
    replaceTransferGatesWithBasicEvents?: boolean;
    type: string;
    missionTestInterval: number | null;
    userDefinedMaxCutset: number;
    targets: string;
    sampling: Sampling;
    importance: Importance;
}

class Configuration {
    engine: Engine;
    quantify: Quantify;
}

export default class QuantificationConfigurations {
    configuration: Configuration;
}