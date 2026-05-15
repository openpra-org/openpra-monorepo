import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from "@nestjs/common";
import { PlantDiagramService } from "./plant-diagram.service";
import { PlantDiagram } from "./schemas/plant-diagram.schema";
function parseId(raw: string): number {
  const n = parseInt(raw, 10);
  if (isNaN(n)) throw new BadRequestException(`Invalid id: "${raw}"`);
  return n;
}
@Controller()
export class PlantDiagramController {
  constructor(private readonly svc: PlantDiagramService) {}
  @Post("/")
  async create(
    @Body()
    body: Partial<PlantDiagram>,
  ): Promise<PlantDiagram> {
    return this.svc.create(body);
  }
  @Get("/by-model/:modelId")
  async findByModel(
    @Param("modelId")
    modelId: string,
  ): Promise<PlantDiagram[]> {
    return this.svc.findByModelId(parseId(modelId));
  }
  @Get("/:id")
  async findById(
    @Param("id")
    id: string,
  ): Promise<PlantDiagram | null> {
    return this.svc.findById(parseId(id));
  }
  @Put("/:id")
  async update(
    @Param("id")
    id: string,
    @Body()
    body: Partial<PlantDiagram>,
  ): Promise<PlantDiagram | null> {
    return this.svc.updateDiagram(parseId(id), body);
  }
  @Delete("/:id")
  async delete(
    @Param("id")
    id: string,
  ): Promise<void> {
    return this.svc.delete(parseId(id));
  }
}
