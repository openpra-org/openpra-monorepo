import Label from "../Label";

/**
 * basic model class to be implemented by all other models in the future, any functionality we want within all models
 * should be contained here
 */
export abstract class BasicModel{

  //state for a basic model
  private id: number;
  private label: Label

  //TODO attach a wiki object here in the basic model if desired.

  /**
   * the name = '' and description = '' automatically tell typscript that these are strings
   * @param {string} name
   * @param {string} description
   */
  constructor(label: Label, id = -1) {
    this.label = label
    this.id = id || -1
  }

  getLabel(): Label{
    return this.label
  }

   /**
   * @return {number} id number
   */
   getId():number {
    return this.id
  }

  /**
   * @param {number} id takes the id number
   */
  setId(id: number) {
    this.id = id;
  }
}
