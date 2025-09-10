import Label from "../Label";

function generateId(length: number = 6): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * basic model class to be implemented by all other models in the future, any functionality we want within all models
 * should be contained here
 */
export abstract class BasicModel {
  //state for a basic model
  private id: string;
  private readonly label: Label;

  //TODO attach a wiki object here in the basic model if desired.

  /**
   * the name = '' and description = '' automatically tell typscript that these are strings
   * @param {string} name
   * @param {string} description
   */
  constructor(label: Label, id: string) {
    this.label = label;
    this.id = id || generateId();
  }

  getLabel(): Label {
    return this.label;
  }

  /**
   * @return {string} id number
   */
  getId(): string {
    return this.id;
  }

  /**
   * @param {number} id takes the id number
   */
  setId(id: string) {
    this.id = id;
  }
}
