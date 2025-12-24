import Label from '../Label';

/**
 * basic model class to be implemented by all other models in the future, any functionality we want within all models
 * should be contained here
 */
export abstract class BasicModel {
  //state for a basic model
  private id: number;
  private readonly label: Label;

  //TODO attach a wiki object here in the basic model if desired.

  /**
   * Construct a basic model.
   * @param label - The model label metadata
   * @param id - The identifier for the model (defaults to -1)
   */
  constructor(label: Label, id = -1) {
    this.label = label;
    this.id = id || -1;
  }

  /**
   * Get the label metadata for this model.
   * @returns The immutable Label instance.
   */
  getLabel(): Label {
    return this.label;
  }

  /**
   * @returns id number
   */
  getId(): number {
    return this.id;
  }

  /**
   * Set the numeric identifier for this model.
   * @param id - The id number to assign.
   */
  setId(id: number): void {
    this.id = id;
  }
}
