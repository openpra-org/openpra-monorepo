import Label from "../Label";
export abstract class BasicModel {
  private id: number;
  private readonly label: Label;
  constructor(label: Label, id = -1) {
    this.label = label;
    this.id = id || -1;
  }
  getLabel(): Label {
    return this.label;
  }
  getId(): number {
    return this.id;
  }
  setId(id: number): void {
    this.id = id;
  }
}
