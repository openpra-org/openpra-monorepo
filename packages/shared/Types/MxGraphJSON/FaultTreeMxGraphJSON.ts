export interface FaultTreeMxGraphJSON extends HCLTreeMxGraphJSON {
    [ReferenceTypes.BASIC_EVENTS]: {[index: string]: BasicEventVertexJSON};
    [ReferenceTypes.HOUSE_EVENTS]: {[index: string]: HouseEventVertexJSON};
    [ReferenceTypes.GATES]: {[index: string]: GateVertexJSON};
    components: {[index: string]: any};
    top_node: OutcomeJSON;
}