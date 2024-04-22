import { Event } from "./Event";

/**
 * @public Represents a basic event in a fault tree, including its failure probability.
 */
export class BasicEvent extends Event {
  prob: number;
  numBasic: number;

  /**
   * Initializes a basic event node with a name, probability, and its position or count in some sequence.
   * @param name - Identifier of the node.
   * @param prob - Probability of the basic event's failure.
   * @param numBasic - Sequential number or count of basic events.
   */
  constructor(name: string, prob: number, numBasic: number) {
    super(name);
    this.prob = prob;
    this.numBasic = numBasic;
  }

  /**
   * Produces the Open-PSA MEF XML definition of the basic event.
   * @returns XML string representation of the basic event.
   */
  toXML(): string {
    return `<define-basic-event name="${this.name}">
              <float value="${this.prob}"/>
            </define-basic-event>`;
  }

  /**
   * Produces the Aralia definition of the basic event.
   * @returns Aralia string representation of the basic event.
   */
  toAralia(): string {
    return `p(${this.name}) = ${this.prob}`;
  }

  /**
   * Produces SaphSolver JSON definition of the basic event.
   * @returns JSON string for SaphSolver.
   */
  toSAPHIREJson(): string {
    return JSON.stringify(
      {
        id: this.name.replace("B", ""),
        corrgate: "0",
        name: this.name,
        evworkspacepair: { ph: 1, mt: 1 },
        value: this.prob,
        initf: "",
        processf: "",
        calctype: "1",
      },
      null,
      2,
    );
  }

  /**
   * Produces OpenPRA JSON definition of the basic event.
   * @returns JSON string for OpenPRA.
   */
  toOpenPRAJson(): string {
    return JSON.stringify(
      {
        [this.name]: {
          role: "public",
          label: {
            name: `Basic Event: ${this.name}`,
            description: "",
          },
          expression: {
            value: this.prob,
            _proxy: "Float",
          },
          source_type: "hcl",
        },
      },
      null,
      2,
    );
  }
}
