import { Module } from "@nestjs/common";
import { failureModesAndEffectsAnalysesService } from "./failureModesAndEffectsAnalyses.service";
import { FailureModesAndEffectsAnalysesController } from "./failureModesAndEffectsAnalyses.controller";
import { MongooseModule } from "@nestjs/mongoose";

import {
  FailureModesAndEffectsAnalyses,
  FailureModesAndEffectsAnalysesSchema,
} from "../nestedModels/schemas/failure-modes-and-effects-analyses.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: FailureModesAndEffectsAnalyses.name,
        schema: FailureModesAndEffectsAnalysesSchema,
      },
    ]),
  ],
  controllers: [FailureModesAndEffectsAnalysesController],
  providers: [failureModesAndEffectsAnalysesService],
  exports: [failureModesAndEffectsAnalysesService],
})
export class FailureModesAndEffectsAnalysesModule {}
