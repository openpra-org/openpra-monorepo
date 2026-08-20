import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { HighWindsPraMefAdapter } from "./high-winds-pra-mef-adapter";
import { HighWindsPraWorkbook, HighWindsPraWorkbookSchema } from "./high-winds-pra-workbook.schema";
import { HighWindsPraWorkbooksController } from "./high-winds-pra-workbooks.controller";
import { HighWindsPraWorkbooksService } from "./high-winds-pra-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HighWindsPraWorkbook.name, schema: HighWindsPraWorkbookSchema }]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [HighWindsPraWorkbooksController],
  providers: [HighWindsPraWorkbooksService, HighWindsPraMefAdapter],
  exports: [HighWindsPraWorkbooksService],
})
export class HighWindsPraWorkbooksModule {}
