import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import type {
  BayesianNetworkBuilderRequest,
  BayesianNetworkBuilderResponse,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { JwtAuthGuard } from "../../../auth/jwt-auth.guard";
import { NetworkBuilderService } from "./network-builder.service";

@Controller("bayesian-network/network-builder")
@UseGuards(JwtAuthGuard)
class NetworkBuilderController {
  constructor(private readonly networkBuilderService: NetworkBuilderService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  build(@Body() body: BayesianNetworkBuilderRequest): BayesianNetworkBuilderResponse {
    return this.networkBuilderService.build(body);
  }
}

export { NetworkBuilderController };
