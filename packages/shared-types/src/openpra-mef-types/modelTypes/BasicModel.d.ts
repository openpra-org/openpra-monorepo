import { Label } from "./Label";

export type StringID = {
  _id: string;
};

export type BasicModel = StringID & {
  label: Label;
  users: number[];
};
