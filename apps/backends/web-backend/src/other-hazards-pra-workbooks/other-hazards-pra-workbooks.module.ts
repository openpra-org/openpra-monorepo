import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { OtherHazardsPraMefAdapter } from "./other-hazards-pra-mef-adapter";
import { OtherHazardsPraWorkbook, OtherHazardsPraWorkbookSchema } from "./other-hazards-pra-workbook.schema";
import { OtherHazardsPraWorkbooksController } from "./other-hazards-pra-workbooks.controller";
import { OtherHazardsPraWorkbooksService } from "./other-hazards-pra-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OtherHazardsPraWorkbook.name, schema: OtherHazardsPraWorkbookSchema }]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [OtherHazardsPraWorkbooksController],
  providers: [OtherHazardsPraWorkbooksService, OtherHazardsPraMefAdapter],
  exports: [OtherHazardsPraWorkbooksService],
})
export class OtherHazardsPraWorkbooksModule {}
