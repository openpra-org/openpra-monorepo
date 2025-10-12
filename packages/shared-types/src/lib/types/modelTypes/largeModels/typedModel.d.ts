import { BasicModel } from "../basicModel";
export interface TypedModelJSON {
    id: number;
    label: {
        name: string;
        description: string;
    };
    users: number[];
}
export type TypedModelJSONMap = Record<string, TypedModelJSON>;
export declare const DEFAULT_TYPED_MODEL_JSON: TypedModelJSON;
export default class TypedModel extends BasicModel {
    users: number[];
    static build(obj: TypedModelJSON): TypedModel;
    constructor(id?: number, name?: string, description?: string, users?: number[]);
    getUsers(): number[];
    setUsers(users: number[]): void;
}
export interface typedModelType {
    _id: string;
    label: {
        name: string;
        description: string;
    };
    users: number[];
    initiatingEvents: string[];
    eventSequenceDiagrams: string[];
    eventSequenceAnalysis: string[];
    functionalEvents?: string[];
    eventTrees: string[];
    faultTrees: string[];
    bayesianNetworks: string[];
    markovChains?: string[];
    bayesianEstimations?: string[];
    weibullAnalysis?: string[];
    id: number;
}
