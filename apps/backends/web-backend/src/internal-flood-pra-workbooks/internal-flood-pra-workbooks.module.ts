import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleWorkbooksModule } from "../example-workbooks/example-workbooks.module";
import { ProjectsModule } from "../projects/projects.module";
import { WorkbooksModule } from "../workbooks/workbooks.module";
import { InternalFloodPraMefAdapter } from "./internal-flood-pra-mef-adapter";
import { InternalFloodPraWorkbook, InternalFloodPraWorkbookSchema } from "./internal-flood-pra-workbook.schema";
import { InternalFloodPraWorkbooksController } from "./internal-flood-pra-workbooks.controller";
import { InternalFloodPraWorkbooksService } from "./internal-flood-pra-workbooks.service";

@Module({
  imports: [MongooseModule.forFeature([{ name: InternalFloodPraWorkbook.name, schema: InternalFloodPraWorkbookSchema }]), ProjectsModule, ExampleWorkbooksModule, WorkbooksModule],
  controllers: [InternalFloodPraWorkbooksController], providers: [InternalFloodPraWorkbooksService, InternalFloodPraMefAdapter], exports: [InternalFloodPraWorkbooksService],
})
export class InternalFloodPraWorkbooksModule {}
