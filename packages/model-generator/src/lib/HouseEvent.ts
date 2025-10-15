import { HouseEventSchema } from "shared-types/src/openpra-mef/house-event";
import { Event } from "./Event";

export class HouseEvent extends Event implements HouseEventSchema {
  flag = true;

  constructor(name: string, parents: Event[] = [], flag = true) {
    super(name, parents); // Call the constructor of the base Event class
    this.flag = flag;
  }

  toXml(printer: (line: string) => void): void {
    printer(`<define-house-event name="${this.name}">`);
    printer(`<constant value="${String(this.flag).toLowerCase()}"/>`);
    printer(`</define-house-event>`);
  }

  toAralia(printer: (line: string) => void): void {
    printer(`s(${this.name}) = ${String(this.flag).toLowerCase()}`);
  }
}
