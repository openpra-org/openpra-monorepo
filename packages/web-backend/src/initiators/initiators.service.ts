import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as argon2 from "argon2";
import * as dot from "dot-object";
import { UpdateOneModel } from "mongodb";
import { MemberResult } from "shared-types/src/lib/api/Members";
import { Initiator, InitiatorDocument } from "./schemas/initiator.schema";

@Injectable()
export class InitiatorService {
  constructor(
    @InjectModel(Initiator.name)
    private readonly initiatorModel: Model<InitiatorDocument>,
  ) {}
}
