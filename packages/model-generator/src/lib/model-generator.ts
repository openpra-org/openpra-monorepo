import {Event} from "./Event";
import { BasicEvent } from "./BasicEvent";
import { Gate } from "./Gate";  
import { HouseEvent } from "./HouseEvent";
import { Factors } from "./Factors";
import { PointEstimate } from "packages/shared-types/src/openpra-mef/data/point-estimate";

export class CcfGroup {
  name: string;
  members: BasicEvent[] = [];
  prob: number | null = null;
  model: string | null = null;
  factors: number[] = [];

  constructor(name: string) {
    this.name = name;
  }

  toXml(printer: (str: string) => void): void {
    printer('<define-CCF-group name="' + this.name + '" model="' + this.model + '">');
    printer(`<members>`);
    for (const member of this.members) {
      printer('<basic-event name="' + member.name + '"/>');
    }
    printer(`</members>`);
    printer('<distribution>');
    printer('<float value="' + this.prob + '"/>');
    printer('</distribution>');
    printer('<factors>');
    if (this.model === 'MGL' && this.factors.length > 0) {
      let level = 2;
      for (const factor of this.factors) {
        printer('<factor level="' + level + '">');
        printer('<float value="' + factor + '"/>');
        printer('</factor>');
        level++;
      }
    }
    printer('</factors>');
    printer('</define-CCF-group>');
  }
}

export class FaultTree {
  name: string | null = null;
  topGate: Gate | null = null;
  topGates: Gate[] | null = null;
  gates: Set<Gate> = new Set();
  basicEvents: Set<BasicEvent> = new Set();
  houseEvents: Set<HouseEvent> = new Set()
  ccfGroups: Set<CcfGroup> = new Set();
  nonCcfEvents: Set<BasicEvent> = new Set();
  
  constructor(name?: string) {
    this.name = name || null;
  }

  toXml(printer: (str: string) => void, nest: boolean = false): void {
    printer('<opsa-mef>');
    printer('<define-fault-tree name="' + this.name + '">');
    for (const gate of this.gates) {
      gate.toXml(printer, nest);
    }
    for (const ccfGroup of this.ccfGroups) {
      ccfGroup.toXml(printer);
    }
    printer('</define-fault-tree>');
    printer('<model-data>');
    const eventsToPrint = this.ccfGroups.size > 0 ? this.nonCcfEvents : this.basicEvents;
    for (const basicEvent of eventsToPrint) {
      basicEvent.toXml(printer);
    }
    for (const houseEvent of this.houseEvents) {
      houseEvent.toXml(printer);
    } 
    printer('</model-data>');
    printer('</opsa-mef>');
  }

  // using set here avoids duplicates, but creates overhead
  addGates(gates: Set<Gate>, shallow: boolean = false): void {
    for (const gate of gates) {
      this.gates.add(gate);
    }
    if (!shallow) {
      for (const gate of gates) {
        for (const bArg of gate.bArguments) {
          this.basicEvents.add(bArg);
        }
        for (const hArg of gate.hArguments) {
          this.houseEvents.add(hArg);
        }
        this.addGates(new Set(gate.gArguments), false); 
      }
    }
  }

  toAralia(printer: (str: string) => void): void {
    printer(this.name || '');
    printer('');
    const sortedGates = toposortGates(this.topGates ? Array.from(this.topGates) : [this.topGate!], Array.from(this.gates));
    for (const gate of sortedGates) {
      gate.toAralia(printer);
    }
    printer('');
    for (const basicEvent of this.basicEvents) {
      basicEvent.toAralia(printer);
    }
    printer('');
    for (const houseEvent of this.houseEvents) {
      houseEvent.toAralia(printer);
    }
  }

  prune(gate: Gate): void {
    if (gate.numArguments() === 1) {
      if (gate.parents.length > 1) {
        console.log('Unexpected number of parents for gate ' + gate.name);
      } else if (gate.parents.length > 0) {
        const parent = Array.from(gate.parents)[0] as Gate;
        parent.removeGate(gate);
        for (const gArg of gate.gArguments) {
          parent.addArgument(gArg);
        }
        for (const bArg of gate.bArguments) {
          parent.addArgument(bArg);
        }
        for (const hArg of gate.hArguments) {
          parent.addArgument(hArg);
        }
        for (const uArg of gate.uArguments) {
          parent.addArgument(uArg);
        }
        this.gates.delete(gate);
        for (const g of gate.gArguments) {
          this.prune(g);
        }
      }
    }
  }
  
}


export function toposortGates(rootGates: Gate[], gates: Gate[]): Gate[] {
  for (const gate of gates) {
    gate.mark = '';
  }

  function visit(gate: Gate, finalList: Gate[]): void {
    if (gate.mark === 'temp') {
      throw new Error('Cycle detected');
    }
    if (!gate.mark) {
      gate.mark = 'temp';
      for (const gArg of gate.gArguments) {
        visit(gArg, finalList);
      }
      gate.mark = 'perm';
      finalList.unshift(gate);
    }
  }

  const sortedGates: Gate[] = [];
  for (const rootGate of rootGates) {
    visit(rootGate, sortedGates);
  }
  if (sortedGates.length !== gates.length) {
    throw new Error('Not all gates sorted');
  }
  for (const gate of gates) {
    gate.mark = null;
  }
  return sortedGates;
}

// Additional classes and functions from fault_tree_generator.py
export class GeneratorFaultTree extends FaultTree {
  factors: Factors;

  constructor (name: string, factors: Factors) {
    super(name);
    this.factors = factors;
  }

  constructTopGate(rootName: string): void {
    const operator = this.factors.getRandomOperator();
    let op = operator;
    while (op === 'xor' || op === 'not') {
      op = this.factors.getRandomOperator();
    }
    this.topGate = new Gate(rootName, op as "xor" | "not" | "and" | "or" | "atleast" | "nor" | "xnor" | "nand" | "imply");
    this.gates.add(this.topGate);
  }

  constructGate(): Gate {
    const gate = new Gate(
      `G${this.gates.size + 1}`,
      this.factors.getRandomOperator() as "xor" | "not" | "and" | "or" | "atleast" | "nor" | "xnor" | "nand" | "imply"
    );
    this.gates.add(gate);
    return gate;
  }

  constructBasicEvent(): BasicEvent {
    const prob = Math.random() * (this.factors.maxProb - this.factors.minProb) + this.factors.minProb;
    const be = new BasicEvent(`B${this.basicEvents.size + 1}`, new PointEstimate(prob));
    this.basicEvents.add(be);
    return be;
  }

  constructHouseEvent(): HouseEvent {
    const state = Math.random() < 0.5 ? true : false;
    const he = new HouseEvent(`H${this.houseEvents.size + 1}`, [], state);
    this.houseEvents.add(he);
    return he;
  }

  constructCcfGroup(members: BasicEvent[]): CcfGroup {
    const ccfGroup = new CcfGroup(`CCF${this.ccfGroups.size + 1}`);
    this.ccfGroups.add(ccfGroup);
    ccfGroup.members = members;
    ccfGroup.prob = Math.random() * (this.factors.maxProb - this.factors.minProb) + this.factors.minProb;
    ccfGroup.model = 'MGL';
    const levels = Math.floor(Math.random() * (members.length - 2 + 1)) + 2;
    ccfGroup.factors = Array.from({ length: levels - 1 }, () => Math.random() * 0.9 + 0.1);
    return ccfGroup;
  }
}

function* candidateGates(commonGate: Gate[]): Generator<Gate> {
  const orphans = commonGate.filter(g => !g.parents || g.parents.length === 0);
  shuffleArray(orphans);
  for (const g of orphans) yield g;
  const singleParent = commonGate.filter(g => g.parents.length === 1);
  shuffleArray(singleParent);
  for (const g of singleParent) yield g;
  const multiParent = commonGate.filter(g => g.parents.length > 1);
  shuffleArray(multiParent);
  for (const g of multiParent) yield g;
}

function shuffleArray(array: any[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}