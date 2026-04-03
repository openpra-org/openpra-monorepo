import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { plant_operating_states_analysis } from "mef-types";
import { PosService } from "./pos.service";

type PlantOperatingStatesAnalysis = plant_operating_states_analysis.PlantOperatingStatesAnalysis;

@UseGuards(AuthGuard("jwt"))
@Controller("models/:modelId/pos")
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get()
  async findAll(@Param("modelId") modelId: string): Promise<PlantOperatingStatesAnalysis[]> {
    return this.posService.findAll(modelId);
  }

  @Get(":uuid")
  async findOne(@Param("modelId") modelId: string, @Param("uuid") uuid: string): Promise<PlantOperatingStatesAnalysis> {
    return this.posService.findOne(modelId, uuid);
  }

  @Post()
  async create(
    @Param("modelId") modelId: string,
    @Body() data: PlantOperatingStatesAnalysis,
  ): Promise<PlantOperatingStatesAnalysis> {
    return this.posService.create(modelId, data);
  }

  @Patch(":uuid")
  async update(
    @Param("modelId") modelId: string,
    @Param("uuid") uuid: string,
    @Body() data: PlantOperatingStatesAnalysis,
  ): Promise<PlantOperatingStatesAnalysis> {
    return this.posService.update(modelId, uuid, data);
  }

  @Delete(":uuid")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("modelId") modelId: string, @Param("uuid") uuid: string): Promise<void> {
    return this.posService.delete(modelId, uuid);
  }
}
