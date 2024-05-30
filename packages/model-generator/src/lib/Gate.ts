import { GateSchema } from "shared-types/src/openpra-mef/gate";
import { UUIDSchema } from "shared-types/src/openpra-mef/identifier/uuid";
import { TypeCodeSchema } from "shared-types/src/openpra-mef/identifier/typecode";
import { Event } from "./Event";
import { BasicEvent } from "./BasicEvent";

/**
 * @public Represents a logical gate within a system model.
 *
 * @remarks A gate can have multiple arguments which can be other gates or events. It is characterized by a boolean
 * operator and can be part of a larger logical structure.
 */
export class Gate extends Event implements GateSchema {
  typecode?: TypeCodeSchema;
  uuid?: UUIDSchema;
  operator: "and" | "or" | "atleast" | "not" | "xor" | "nor" | "xnor" | "nand" | "imply";
  kNum?: number;
  private _gArguments: Set<Gate>;
  private _bArguments: Set<BasicEvent>;
  private _hArguments: Set<HouseEvent>;
  private _uArguments: Set<Event>;

  constructor(
    name: string,
    operator: "and" | "or" | "atleast" | "not" | "xor" | "nor" | "xnor" | "nand" | "imply",
    typecode?: TypeCodeSchema,
    uuid?: UUIDSchema,
    kNum?: number,
    gArguments?: [],
    bArguments?: [],
    hArguments?: [],
    uArguments?: [],
  ) {
    super(name);
    this.typecode = typecode;
    this.uuid = uuid;
    this.operator = operator;
    this.kNum = kNum;
    this._gArguments = new Set<Gate>(gArguments);
    this._bArguments = new Set<BasicEvent>(bArguments);
    this._hArguments = new Set<Event>(hArguments);
    this._uArguments = new Set<Event>(uArguments);
  }

  get bArguments(): BasicEvent[] {
    return Array.from(this._bArguments);
  }

  set bArguments(toSet) {
    this._bArguments = new Set<BasicEvent>(toSet);
  }

  get gArguments(): Gate[] {
    return Array.from(this._gArguments);
  }

  set gArguments(toSet) {
    this._gArguments = new Set<Gate>(toSet);
  }

  get hArguments(): Event[] {
    return Array.from(this._hArguments);
  }

  set hArguments(toSet) {
    this._hArguments = new Set<Event>(toSet);
  }

  get uArguments(): Event[] {
    return Array.from(this._uArguments);
  }

  set uArguments(toSet) {
    this._uArguments = new Set<Event>(toSet);
  }

  /**
   * @remarks Returns the number of arguments.
   *
   * @returns The total number of arguments.
   */
  numArguments(): number {
    return this._gArguments.size + this._bArguments.size + this._hArguments.size + this._uArguments.size;
  }

  /**
   * @remarks Adds argument into a collection of gate arguments. This function also updates the parent set of the
   * argument. Duplicate arguments are ignored. The logic of the Boolean operator is not taken into account upon
   * adding arguments to the gate. Therefore, no logic checking is performed for repeated or complement arguments.
   *
   * @param argument - Gate, HouseEvent, BasicEvent, or Event argument.
   */
  addArgument(argument: Gate | Event): void {
    argument.addParent(this);
    if (argument instanceof Gate) {
      this._gArguments.add(argument);
    } else {
      this._uArguments.add(argument);
    }
  }

  /**
   * @remarks Collects ancestors from this gate.
   *
   * @returns A set of ancestors.
   */
  getAncestors(): Set<Gate | Event> {
    const ancestors = new Set<Gate | Event>([this]);
    let parents: (Gate | Event)[] = Array.from(this.parents); // to avoid recursion
    while (parents.length > 0) {
      const parent = parents.shift();
      if (parent && !ancestors.has(parent)) {
        ancestors.add(parent);
        parents = parents.concat(Array.from(parent.parents));
      }
    }
    return ancestors;
  }
}
