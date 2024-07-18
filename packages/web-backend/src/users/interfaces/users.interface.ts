import { Document } from "mongoose";

export interface UserGql extends Document {
  readonly username: string;
  readonly password: string;
}
