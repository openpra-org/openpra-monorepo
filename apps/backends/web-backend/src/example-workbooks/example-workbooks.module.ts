import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ExampleWorkbook, ExampleWorkbookSchema } from "./example-workbook.schema";
import { ExampleWorkbooksController } from "./example-workbooks.controller";
import { ExampleDocumentsController } from "./example-documents.controller";
import { ExampleWorkbooksService } from "./example-workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExampleWorkbook.name, schema: ExampleWorkbookSchema },
    ]),
  ],
  controllers: [ExampleWorkbooksController, ExampleDocumentsController],
  providers: [ExampleWorkbooksService],
  exports: [ExampleWorkbooksService],
})
export class ExampleWorkbooksModule {}
