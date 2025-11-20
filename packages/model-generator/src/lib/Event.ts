import { EventSchema } from "shared-types/src/openpra-mef/systems-analysis/event";
import { TypeCodeSchema } from "shared-types/src/openpra-mef/identifier/typecode";
import { UUIDSchema } from "shared-types/src/openpra-mef/identifier/uuid";
/**
 * @public Representation of a base class for an event in a fault tree. This class provides methods to manage and query
 * the parents of an event.
*/
export class Event implements EventSchema {
  name: string;
  private _parents: Set<Event> = new Set<Event>();
  
  typecode?: TypeCodeSchema;
  uuid?: UUIDSchema;
  
  /**
   * @remarks Constructs a new node with a unique name.
   * @param name - Identifier for the node.
   * @param parents - Parents of the event.
   * @param uuid - Unique identifier for this event
  */
 constructor(name: string, parents: Event[] = [], uuid?: UUIDSchema) {
   this.name = name;
   this.parents = parents;
   this.uuid = uuid;
  }
  
  get parents(): Event[] {
    return Array.from(this._parents);
  }
  
  set parents(toSet) {
    this._parents = new Set<Event>(toSet);
  }
  
  /**
   * @remarks Indicates if this node appears in several places.
   * @returns True if the node has more than one parent, false otherwise.
  */
 isCommon(): boolean {
   return this._parents.size > 1;
  }
  
  /**
   * @remarks Determines if the node has no parents.
   * @returns True if the node has no parents, false otherwise.
  */
 isOrphan(): boolean {
   return this._parents.size === 0;
  }
  
  /**
   * @remarks Returns the number of unique parents.
   * @returns The number of unique parents.
  */
 numParents(): number {
   return this._parents.size;
  }
  
  /**
   * @remarks Adds a gate as a parent of the node. This method will throw an error if the gate is already a parent of
   * the node.
   * @param gate - The gate where this node appears.
  */
 addParent(gate: Event): void {
   if (this._parents.has(gate)) {
     throw new Error("Gate is already a parent of this node.");
    }
    this._parents.add(gate);
  }
}
