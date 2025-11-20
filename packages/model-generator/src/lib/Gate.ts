import { GateSchema } from "shared-types/src/openpra-mef/systems-analysis/gate";
import { UUIDSchema } from "shared-types/src/openpra-mef/identifier/uuid";
import { TypeCodeSchema } from "shared-types/src/openpra-mef/identifier/typecode";
import { Event } from "./Event";
import { BasicEvent } from "./BasicEvent";
import { HouseEvent } from "./HouseEvent";

/**
 * @public Represents a logical gate within a system model.
 *
 * @remarks A gate can have multiple arguments which can be other gates or events. It is characterized by a boolean
 * operator and can be part of a larger logical structure.
 */
export class Gate extends Event implements GateSchema {
  mark: any = null; 
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
  ) {
    super(name);
    this.operator = operator;
    this.kNum = kNum;
    this._gArguments = new Set<Gate>();
    this._bArguments = new Set<BasicEvent>();
    this._hArguments = new Set<HouseEvent>();
    this._uArguments = new Set<Event>();
  }

  get bArguments(): BasicEvent[] {
    return Array.from(this._bArguments);
  }

  set bArguments(toSet: BasicEvent[]) {
    this._bArguments = new Set<BasicEvent>(toSet);
  }

  get gArguments(): Gate[] {
    return Array.from(this._gArguments);
  }

  set gArguments(toSet: Gate[]) {
    this._gArguments = new Set<Gate>(toSet);
  }

  get hArguments(): HouseEvent[] {
    return Array.from(this._hArguments);
  }

  set hArguments(toSet: HouseEvent[]) {
    this._hArguments = new Set<HouseEvent>(toSet);
  }

  get uArguments(): Event[] {
    return Array.from(this._uArguments);
  }

  set uArguments(toSet: Event[]) {
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
  addArgument(argument: Gate | BasicEvent | HouseEvent | Event): void {
    argument.addParent(this);
    if (argument instanceof Gate) {
      this._gArguments.add(argument);
    } else if (argument instanceof BasicEvent) {
      this._bArguments.add(argument);
    } else if (argument instanceof HouseEvent) {
      this._hArguments.add(argument);
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

  removeGate(gate: Gate): void {
    this._gArguments.delete(gate);
  }


  toXml(printer: (line: string) => void, nest: boolean = false): void {
  const argToXml = (typeStr: string, arg: Event): string => {
    return `<${typeStr} name="${arg.name}"/>`;  // Changed from "ref" to "name"
  };

  const argsToXml = (typeStr: string, args: Event[]): string => {
    return args.map((arg) => argToXml(typeStr, arg)).join("");  // Remove \n
  };

  const convertFormula = (gate: Gate, nest: boolean = false): string => {
    let mefXml = '';
    mefXml += '<' + gate.operator;
    if (gate.operator === 'atleast') {
      mefXml += ` min="${gate.kNum}"`;
    }
    mefXml += '>';
    
    mefXml += argsToXml('house-event', gate.hArguments);
    mefXml += argsToXml('basic-event', gate.bArguments);
    mefXml += argsToXml('event', gate.uArguments);

    const converter = (argGate: Gate): string => {
      if (gate.operator !== 'not' && argGate.operator === 'not') {
        return convertFormula(argGate);
      }
      return argToXml('gate', argGate);
    };

    if (nest) {
      mefXml += gate.gArguments.map(converter).join('');
    } else {
      mefXml += argsToXml('gate', gate.gArguments);
    }

    mefXml += '</' + gate.operator + '>';
    
    return mefXml;
  };

  printer(`<define-gate name="${this.name}">`);
  printer(convertFormula(this, nest));
  printer(`</define-gate>`);
}

  /**
   * Produces the Aralia definition of the gate.
   * The transformation to the Aralia format does not support complement or undefined arguments.
   * @param printer - The output stream.
   * @throws Error if undefined arguments are present or operator is unsupported.
   */
  toAralia(printer: (line: string) => void): void {
    if (this._uArguments.size > 0) {
      throw new Error("Undefined arguments are not supported in Aralia format.");
    }

    const getFormat = (operator: string): [string, string, string] => {
      if (operator === 'atleast') {
        return [`@(${this.kNum}, [`, ', ', '])'];
      }
      const formats: { [key: string]: [string, string, string] } = {
        'and': ['(', ' & ', ')'],
        'or': ['(', ' | ', ')'],
        'not': ['~(', '', ')'],
        'xor': ['(', ' ^ ', ')'],
        'nor': ['nor(', ', ', ')'],
        'xnor': ['xnor(', ', ', ')'],
        'nand': ['nand(', ', ', ')'],
        'imply': ['imply(', ', ', ')'],
      };
      if (!formats[operator]) {
        throw new Error(`Operator ${operator} is not supported in Aralia format.`);
      }
      return formats[operator];
    };

    const [lineStart, div, lineEnd] = getFormat(this.operator);
    const line: string[] = [this.name, ' := ', lineStart];
    const args: string[] = [];
    for (const hArg of this.hArguments) {
      args.push(hArg.name);
    }
    for (const bArg of this.bArguments) {
      args.push(bArg.name);
    }
    for (const gArg of this.gArguments) {
      args.push(gArg.name);
    }
    line.push(args.join(div));
    line.push(lineEnd);
    printer(line.join(''));
  }
}
