import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/user.schema";
import { ProjectsModule } from "../projects/projects.module";
import { PosWorkbooksModule } from "../pos-workbooks/pos-workbooks.module";
import { Workbook, WorkbookSchema } from "./workbook.schema";
import { WorkbooksController } from "./workbooks.controller";
import { WorkbooksService } from "./workbooks.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workbook.name, schema: WorkbookSchema },
      { name: User.name, schema: UserSchema },
    ]),
    ProjectsModule,
    PosWorkbooksModule,
  ],
  controllers: [WorkbooksController],
  providers: [WorkbooksService],
})
export class WorkbooksModule {}
