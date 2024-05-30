import { HouseEventSchema } from "shared-types/src/openpra-mef/house-event";
import { Event } from "./Event";

export class HouseEvent extends Event implements HouseEventSchema {
  flag = true;

  constructor(name: string, parents: Event[] = [], flag = true) {
    super(name, parents); // Call the constructor of the base Event class
    this.flag = flag;
  }
}
