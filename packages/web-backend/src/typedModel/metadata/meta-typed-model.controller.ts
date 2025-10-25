import { Controller, Get, Request, UseFilters, UseGuards } from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { AuthGuard } from "@nestjs/passport";
import { InternalEventsMetadata } from "../schemas/internal-events.schema";
import { InvalidTokenFilter } from "../../filters/invalid-token.filter";
import { MetaTypedModelService } from "./meta-typed-model.service";

@Controller()
@UseGuards(AuthGuard("jwt"))
@UseFilters(InvalidTokenFilter)
export class MetaTypedModelController {
  constructor(private readonly metaTypedModelService: MetaTypedModelService) {}
  //get methods for collections

  /**
   *
   * @param id - the id of the user whose models you want to retrieve
   * @returns a list of the internal hazards moodels the user is on
   */
  @Get("/metadata/internal-events/")
  async getInternalEvents(@Request() req: ExpressRequest): Promise<InternalEventsMetadata[]> {
    const userId: unknown = (req as unknown as { user?: { user_id?: unknown } })?.user?.user_id;
    const idNum = typeof userId === "number" ? userId : typeof userId === "string" ? Number(userId) : undefined;
    return this.metaTypedModelService.getInternalEventsMetaData(idNum as number);
  }
}
