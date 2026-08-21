import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../../projects/projects.module";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "./analysis-run-record.schema";
import { MethodModelRecord, MethodModelRecordSchema } from "./method-model-record.schema";
import { MethodModelsController } from "./method-models.controller";
import { MethodModelsService } from "./method-models.service";

/** Shared backend infrastructure for the method editors belongs in this module. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: MethodModelRecord.name, schema: MethodModelRecordSchema }]),
    MongooseModule.forFeature([{ name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema }]),
    ProjectsModule,
  ],
  controllers: [MethodModelsController],
  providers: [MethodModelsService],
  exports: [MongooseModule, MethodModelsService],
})
export class NewlyDevelopedMethodsSharedModule {}
