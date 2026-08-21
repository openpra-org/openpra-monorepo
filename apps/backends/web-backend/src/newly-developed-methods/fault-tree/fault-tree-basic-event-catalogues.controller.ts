import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type {
  FaultTreeBasicEventCatalogue,
  FaultTreeBasicEventCatalogueCreateRequest,
  FaultTreeBasicEventCataloguePatchRequest,
} from "interfaces-shared-types/newly-developed-methods";
import {
  FaultTreeBasicEventCatalogueCreateRequestSchema,
  FaultTreeBasicEventCataloguePatchRequestSchema,
} from "interfaces-shared-types/newly-developed-methods";
import { JwtAuthGuard, type AuthenticatedRequest } from "../../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../../pipe/zod-validation.pipe";
import { FaultTreeBasicEventCataloguesService } from "./fault-tree-basic-event-catalogues.service";

@Controller("projects/:projectId/fault-tree-basic-event-catalogue")
@UseGuards(JwtAuthGuard)
class FaultTreeBasicEventCataloguesController {
  constructor(
    private readonly cataloguesService: FaultTreeBasicEventCataloguesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(FaultTreeBasicEventCatalogueCreateRequestSchema))
    body: FaultTreeBasicEventCatalogueCreateRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<FaultTreeBasicEventCatalogue> {
    return this.cataloguesService.create(projectId, body, {
      username: request.user!.username,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  load(
    @Param("projectId") projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<FaultTreeBasicEventCatalogue> {
    return this.cataloguesService.load(projectId, {
      username: request.user!.username,
    });
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  patch(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(FaultTreeBasicEventCataloguePatchRequestSchema))
    body: FaultTreeBasicEventCataloguePatchRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<FaultTreeBasicEventCatalogue> {
    return this.cataloguesService.patch(projectId, body, {
      username: request.user!.username,
    });
  }
}

export { FaultTreeBasicEventCataloguesController };
