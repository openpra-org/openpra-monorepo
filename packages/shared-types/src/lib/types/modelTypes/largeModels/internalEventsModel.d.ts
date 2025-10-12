import TypedModel, { typedModelType } from "./typedModel";
export declare class InternalEventsModel extends TypedModel {
}
export type InternalEventsModelType = typedModelType;
export interface InternalEventsMetadata {
    _id: string;
    label: {
        name: string;
        description: string;
    };
    users: number[];
}
