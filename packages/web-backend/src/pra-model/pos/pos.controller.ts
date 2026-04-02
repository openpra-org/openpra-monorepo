import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { plant_operating_states_analysis } from "mef-types";
import { PosService } from "./pos.service";

type PlantOperatingStatesAnalysis = plant_operating_states_analysis.PlantOperatingStatesAnalysis;

@UseGuards(AuthGuard("jwt"))
@Controller("models/:modelId/pos")
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post()
  async create(
    @Param("modelId") modelId: string,
    @Body() data: PlantOperatingStatesAnalysis,
  ): Promise<PlantOperatingStatesAnalysis> {
    return this.posService.create(modelId, data);
  }
}
