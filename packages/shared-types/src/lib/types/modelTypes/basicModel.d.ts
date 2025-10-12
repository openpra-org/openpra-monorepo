import Label from "../Label";
export declare abstract class BasicModel {
    private id;
    private readonly label;
    constructor(label: Label, id?: number);
    getLabel(): Label;
    getId(): number;
    setId(id: number): void;
}
