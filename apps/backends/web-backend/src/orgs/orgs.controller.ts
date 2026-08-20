import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from "@nestjs/common";
import type { OrgSearchResponse, OrgSummary } from "interfaces-shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrgsService } from "./orgs.service";

@Controller("orgs")
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get("search")
  @HttpCode(HttpStatus.OK)
  search(@Query("q") q?: string): Promise<OrgSearchResponse> {
    return this.orgsService.searchOrgs(q ?? "");
  }

  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  getOne(@Param("slug") slug: string): Promise<OrgSummary> {
    return this.orgsService.getBySlug(slug);
  }
}
