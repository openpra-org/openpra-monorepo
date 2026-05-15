import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreatePraModelDto, PraModelService } from "./pra-model.service";
import { PraModelMeta } from "../schemas/pra-model.schema";
@UseGuards(AuthGuard("jwt"))
@Controller("models")
export class PraModelController {
  constructor(private readonly praModelService: PraModelService) {}
  @Get()
  async findAll(): Promise<PraModelMeta[]> {
    return this.praModelService.findAll();
  }
  @Get(":uuid")
  async findOne(
    @Param("uuid")
    uuid: string,
  ): Promise<PraModelMeta> {
    return this.praModelService.findOne(uuid);
  }
  @Post()
  async create(
    @Body()
    dto: CreatePraModelDto,
  ): Promise<PraModelMeta> {
    return this.praModelService.create(dto);
  }
  @Delete(":uuid")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param("uuid")
    uuid: string,
  ): Promise<void> {
    return this.praModelService.delete(uuid);
  }
}
