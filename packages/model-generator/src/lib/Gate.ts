import { Event } from "./Event";

/**
 * @public Represents a logical gate within a system model.
 *
 * @remarks A gate can have multiple arguments which can be other gates or events. It is characterized by a boolean
 * operator and can be part of a larger logical structure.
 */
export class Gate extends Event {
  operator: string;
  kNum: number | null;
  gArguments: Set<Gate>;
  bArguments: Set<Event>; // Assuming BasicEvent extends Event
  hArguments: Set<Event>; // Assuming HouseEvent extends Event
  uArguments: Set<Event>;
  mark: boolean;

  /**
   * @remarks Initializes a gate.
   *
   * @param name - Identifier of the node.
   * @param operator - Boolean operator of this formula.
   * @param kNum - Min number for the combination operator.
   */
  constructor(name: string, operator: string, kNum: number | null = null) {
    super(name);
    this.mark = false;
    this.operator = operator;
    this.kNum = kNum;
    this.gArguments = new Set<Gate>();
    this.bArguments = new Set<Event>();
    this.hArguments = new Set<Event>();
    this.uArguments = new Set<Event>();
  }

  /**
   * @remarks Returns the number of arguments.
   *
   * @returns The total number of arguments.
   */
  numArguments(): number {
    return (
      this.gArguments.size +
      this.bArguments.size +
      this.hArguments.size +
      this.uArguments.size
    );
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
      this.gArguments.add(argument);
    } else {
      this.uArguments.add(argument);
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
