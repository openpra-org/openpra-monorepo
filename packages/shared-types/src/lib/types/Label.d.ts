import { Parsable } from "./Parsable";
import { Defaults } from "./ObjectTypes";
export interface LabelJSON {
    name: string;
    description: string;
}
export type LabelJSONMap = Record<string, LabelJSON>;
export declare const DEFAULT_LABEL_JSON: LabelJSON;
export default class Label implements Parsable<LabelJSONMap, LabelJSON> {
    name: string;
    description: string;
    static build(obj: LabelJSON): Label;
    constructor(name?: string, description?: string);
    getName(): string;
    setName(name: string): void;
    getDescription(): string;
    setDescription(description: string): void;
    toJSON(): LabelJSON;
    getDefaultJSON(): LabelJSON;
    clone(): Label;
    getDefaultMappedJSON(): Defaults<LabelJSONMap>;
    toPartialMappedJSON(): Partial<LabelJSONMap>;
}
