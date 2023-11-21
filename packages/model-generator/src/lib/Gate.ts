import Event from "./Event";

/**
 * @public Represents a logical gate within a system model.
 *
 * @remarks A gate can have multiple arguments which can be other gates or events. It is characterized by a boolean
 * operator and can be part of a larger logical structure.
 */
export default class Gate extends Event {
  operator: string;
  k_num: number | null;
  g_arguments: Set<Gate>;
  b_arguments: Set<Event>; // Assuming BasicEvent extends Event
  h_arguments: Set<Event>; // Assuming HouseEvent extends Event
  u_arguments: Set<Event>;
  mark: boolean;

  /**
   * @remarks Initializes a gate.
   *
   * @param name - Identifier of the node.
   * @param operator - Boolean operator of this formula.
   * @param k_num - Min number for the combination operator.
   */
  constructor(name: string, operator: string, k_num: number | null = null) {
    super(name);
    this.mark = false;
    this.operator = operator;
    this.k_num = k_num;
    this.g_arguments = new Set<Gate>();
    this.b_arguments = new Set<Event>();
    this.h_arguments = new Set<Event>();
    this.u_arguments = new Set<Event>();
  }

  /**
   * @remarks Returns the number of arguments.
   *
   * @returns The total number of arguments.
   */
  num_arguments(): number {
    return (
      this.g_arguments.size +
      this.b_arguments.size +
      this.h_arguments.size +
      this.u_arguments.size
    );
  }

  /**
   * @remarks Adds argument into a collection of gate arguments. This function also updates the parent set of the
   * argument. Duplicate arguments are ignored. The logic of the Boolean operator is not taken into account upon
   * adding arguments to the gate. Therefore, no logic checking is performed for repeated or complement arguments.
   *
   * @param argument - Gate, HouseEvent, BasicEvent, or Event argument.
   */
  add_argument(argument: Gate | Event): void {
    argument.addParent(this);
    if (argument instanceof Gate) {
      this.g_arguments.add(argument);
    } else {
      this.u_arguments.add(argument);
    }
  }

  /**
   * @remarks Collects ancestors from this gate.
   *
   * @returns A set of ancestors.
   */
  get_ancestors(): Set<Gate | Event> {
    const ancestors = new Set<Gate | Event>([this]);
    let parents: Array<Gate | Event> = Array.from(this.parents); // to avoid recursion
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
