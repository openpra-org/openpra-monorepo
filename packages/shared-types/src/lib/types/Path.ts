import Outcome, { OutcomeJSON } from "./Outcome";
import Instruction, { InstructionJSON } from "./Instruction";

export interface PathJSON {
  outcome?: OutcomeJSON;
  instructions?: InstructionJSON[];
}

class Path {
  private outcome: Outcome;
  private instructions: Instruction[];

  /**
   * @param {PathJSON} obj - dictionary object to parse
   */
  constructor(obj: PathJSON = {}) {
    this.outcome = Outcome.build(obj.outcome);
    this.instructions = obj.instructions?.map(
      (instruction) => new Instruction(instruction),
    ) || [new Instruction()];
  }

  /**
   * @return {Outcome}
   */
  getOutcome(): Outcome {
    return this.outcome;
  }

  /**
   * @param {Outcome} outcome
   */
  setOutcome(outcome: Outcome) {
    this.outcome = outcome;
  }

  /**
   * @return {Instruction[]}
   */
  getInstructions(): Instruction[] {
    return this.instructions;
  }

  /**
   * @param {Instruction[]} instructions
   */
  setInstructions(instructions: Instruction[]) {
    this.instructions = instructions;
  }

  /**
   * @return {PathJSON} - dictionary object that describes this
   */
  toJSON(): PathJSON {
    return {
      outcome: this.outcome.toJSON(),
      instructions: this.instructions.map((instruction) =>
        instruction.toJSON(),
      ),
    };
  }
}

export default Path;
