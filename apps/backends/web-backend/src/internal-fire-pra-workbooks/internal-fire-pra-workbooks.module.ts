import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ProjectsModule } from "../projects/projects.module";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { InternalFirePraMefAdapter } from "./internal-fire-pra-mef-adapter";
import { InternalFirePraWorkbook, InternalFirePraWorkbookSchema } from "./internal-fire-pra-workbook.schema";
import { InternalFirePraWorkbooksController } from "./internal-fire-pra-workbooks.controller";
import { InternalFirePraWorkbooksService } from "./internal-fire-pra-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: InternalFirePraWorkbook.name, schema: InternalFirePraWorkbookSchema }]),
    ProjectsModule,
    ExampleWorkbooksModule,
    WorkbooksModule,
  ],
  controllers: [InternalFirePraWorkbooksController],
  providers: [InternalFirePraWorkbooksService, InternalFirePraMefAdapter],
  exports: [InternalFirePraWorkbooksService],
})
export class InternalFirePraWorkbooksModule {}
