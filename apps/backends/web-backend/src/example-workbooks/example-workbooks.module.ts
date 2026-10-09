import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleWorkbook, ExampleWorkbookSchema } from "./example-workbook.schema";
import { ScWorkbook, ScWorkbookSchema } from "../sc-workbooks/sc-workbook.schema";
import { DaWorkbook, DaWorkbookSchema } from "../da-workbooks/da-workbook.schema";
import { SyWorkbook, SyWorkbookSchema } from "../sy-workbooks/sy-workbook.schema";
import { ExampleWorkbooksController } from "./example-workbooks.controller";
import { ExampleDocumentsController } from "./example-documents.controller";
import { ExampleWorkbooksService } from "./example-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExampleWorkbook.name, schema: ExampleWorkbookSchema },
      { name: ScWorkbook.name, schema: ScWorkbookSchema },
      { name: DaWorkbook.name, schema: DaWorkbookSchema },
      { name: SyWorkbook.name, schema: SyWorkbookSchema },
    ]),
  ],
  controllers: [ExampleWorkbooksController, ExampleDocumentsController],
  providers: [ExampleWorkbooksService],
  exports: [ExampleWorkbooksService],
})
export class ExampleWorkbooksModule {}
