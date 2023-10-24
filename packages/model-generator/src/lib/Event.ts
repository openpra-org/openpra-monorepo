/**
 * @file Event.ts
 * @brief Representation of a base class for an event in a fault tree.
 * @details This class provides methods to manage and query the parents of an event.
 */

export default class Event {
  name: string;
  parents: Set<Event>;

  /**
   * @brief Constructs a new node with a unique name.
   * @details Note that the tracking of parents introduces a cyclic reference.
   * @param name Identifier for the node.
   */
  constructor(name: string) {
    this.name = name;
    this.parents = new Set<Event>();
  }

  /**
   * @brief Indicates if this node appears in several places.
   * @returns True if the node has more than one parent, false otherwise.
   */
  isCommon(): boolean {
    return this.parents.size > 1;
  }

  /**
   * @brief Determines if the node has no parents.
   * @returns True if the node has no parents, false otherwise.
   */
  isOrphan(): boolean {
    return this.parents.size === 0;
  }

  /**
   * @brief Returns the number of unique parents.
   * @returns The number of unique parents.
   */
  numParents(): number {
    return this.parents.size;
  }

  /**
   * @brief Adds a gate as a parent of the node.
   * @details This method will throw an error if the gate is already a parent of the node.
   * @param gate The gate where this node appears.
   */
  addParent(gate: Event): void {
    if (this.parents.has(gate)) {
      throw new Error("Gate is already a parent of this node.");
    }
    this.parents.add(gate);
  }
}
