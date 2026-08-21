import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../../projects/projects.module";
import { WorkbooksModule } from "../../workbooks/workbooks.module";
import {
  FaultTreeBasicEventCatalogueRecord,
  FaultTreeBasicEventCatalogueRecordSchema,
} from "../fault-tree/fault-tree-basic-event-catalogue-record.schema";
import { AnalysisRunRecord, AnalysisRunRecordSchema } from "./analysis-run-record.schema";
import { MethodModelRecord, MethodModelRecordSchema } from "./method-model-record.schema";
import { MethodModelsController } from "./method-models.controller";
import { MethodModelsService } from "./method-models.service";
import { PraetorAnalysisClient } from "./praetor-analysis.client";

/** Shared backend infrastructure for the method editors belongs in this module. */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: MethodModelRecord.name, schema: MethodModelRecordSchema }]),
    MongooseModule.forFeature([{ name: AnalysisRunRecord.name, schema: AnalysisRunRecordSchema }]),
    MongooseModule.forFeature([
      {
        name: FaultTreeBasicEventCatalogueRecord.name,
        schema: FaultTreeBasicEventCatalogueRecordSchema,
      },
    ]),
    ProjectsModule,
    WorkbooksModule,
  ],
  controllers: [MethodModelsController],
  providers: [MethodModelsService, PraetorAnalysisClient],
  exports: [MongooseModule, MethodModelsService, PraetorAnalysisClient],
})
export class NewlyDevelopedMethodsSharedModule {}
