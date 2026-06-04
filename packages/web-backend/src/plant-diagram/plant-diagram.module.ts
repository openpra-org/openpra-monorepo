import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { PlantDiagramController } from "./plant-diagram.controller";
import { PlantDiagramService } from "./plant-diagram.service";
import { PlantDiagram, PlantDiagramSchema } from "./schemas/plant-diagram.schema";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PlantDiagram.name, schema: PlantDiagramSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
    ]),
  ],
  controllers: [PlantDiagramController],
  providers: [PlantDiagramService],
  exports: [PlantDiagramService],
})
export class PlantDiagramModule {}
