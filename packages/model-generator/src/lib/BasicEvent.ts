import { BasicEventSchema } from "shared-types/src/openpra-mef/basic-event";
import { Event } from "./Event";
import { PointEstimate } from "./PointEstimate";

export class BasicEvent extends Event implements BasicEventSchema {
  private __probability: PointEstimate; // Private attribute like Python's __probability

  constructor(name: string, probability: PointEstimate) {
    super(name); // Call the constructor of the base Event class
    this.__probability = probability; // Set the probability directly
  }
  get probability(): number {
    return this.__probability.value;
  }

  set probability(value: number) {
    this.__probability.value = value;
  }

  toXml(printer: (line: string) => void): void {
    printer(`<define-basic-event name="${this.name}">`);
    this.__probability.toXml(printer); // Delegate to the probability object's toXml method
    printer(`</define-basic-event>`);
  }

  toAralia(printer: (line: string) => void): void {
    printer(`${this.name} `);
    this.__probability.toAralia(printer);
  }
}