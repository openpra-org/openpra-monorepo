import { Expose } from "class-transformer";

class Model_Data {
    @Expose()
    "bayesian_networks": number[]

    @Expose()
    "event_trees": number[]

    @Expose()
    "fault_trees": number[]

    @Expose()
    "init_events": number[]
}

export class HclModelResponseDto {
    @Expose()
    id: number;

    @Expose()
    title: string;

    @Expose()
    date_created: string;

    @Expose()
    date_modified: string;

    @Expose()
    creator: number;

    @Expose()
    assigned_users: number[];

    @Expose()
    description: string;

    @Expose()
    actions: any;

    @Expose()
    instances: any;

    @Expose()
    model_data: Model_Data;

    @Expose()
    results: any;

    @Expose()
    overview_tree: number;

    @Expose()
    tag: string;
}