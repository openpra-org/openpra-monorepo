import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { ExternalFloodPraMefAdapter } from "./external-flood-pra-mef-adapter";
import { ExternalFloodPraWorkbook, ExternalFloodPraWorkbookSchema } from "./external-flood-pra-workbook.schema";
import { ExternalFloodPraWorkbooksController } from "./external-flood-pra-workbooks.controller";
import { ExternalFloodPraWorkbooksService } from "./external-flood-pra-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExternalFloodPraWorkbook.name, schema: ExternalFloodPraWorkbookSchema }]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [ExternalFloodPraWorkbooksController],
  providers: [ExternalFloodPraWorkbooksService, ExternalFloodPraMefAdapter],
  exports: [ExternalFloodPraWorkbooksService],
})
export class ExternalFloodPraWorkbooksModule {}
