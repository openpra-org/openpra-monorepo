
/**
 * basic model class to be implemented by all other models in the future, any functionality we want within all models
 * should be contained here
 */
export abstract class BasicModel {

  //state for a basic model
  private name: string;
  private description?: string;

  //TODO attach a wiki object here in the basic model if desired.

  /**
   * the name = '' and description = '' automatically tell typscript that these are strings
   * @param {string} name
   * @param {string} description
   */
  constructor(name = '', description = '') {
    this.name = name || '';
    this.description = description || '';
  }

  /**
   * @return {string} name
   */
  getName(): string {
    return this.name;
  }

  /**
   * @param {string} name
   */
  setName(name: string) {
    this.name = name;
  }

  /**
   * @return {string} description
   */
  getDescription(): string {
    if(this.description)
      return this.description;
    return ""
  }

  /**
   * @param {string} description
   */
  setDescription(description: string) {
    this.description = description;
  }
}
