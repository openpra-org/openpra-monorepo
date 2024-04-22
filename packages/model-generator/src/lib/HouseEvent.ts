import { Event } from "./Event";

/**
 * Represents a house event in a fault tree.
 */
export class HouseEvent extends Event {
  state: string;

  /**
   * Initializes a house event with a given name and state.
   * @param name The identifier of the node.
   * @param state The state of the event as a string ("true" or "false").
   */
  constructor(name: string, state: string) {
    super(name);
    this.state = state;
  }

  /**
   * Produces the Open-PSA MEF XML definition of the house event.
   * @returns The XML string representation of the house event.
   */
  toXML(): string {
    return `<define-house-event name="${this.name}"><constant value="${this.state}"/></define-house-event>`;
  }

  /**
   * Produces the Aralia definition of the house event.
   * @returns The Aralia string representation of the house event.
   */
  toAralia(): string {
    return `s(${this.name}) = ${this.state}`;
  }
}
