import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ModelCounter, ModelCounterSchema } from "../schemas/model-counter.schema";
import { FmeaController } from "./fmea.controller";
import { FmeaService } from "./fmea.service";
import { Fmea, FmeaSchema } from "./schemas/fmea.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Fmea.name, schema: FmeaSchema },
      { name: ModelCounter.name, schema: ModelCounterSchema },
    ]),
  ],
  controllers: [FmeaController],
  providers: [FmeaService],
  exports: [FmeaService],
})
export class FmeaModule {}
