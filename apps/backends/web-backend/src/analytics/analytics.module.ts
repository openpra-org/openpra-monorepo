import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/user.schema";
import { Project, ProjectSchema } from "../projects/project.schema";
import { Workbook, WorkbookSchema } from "../workbooks/workbook.schema";
import { PosWorkbook, PosWorkbookSchema } from "../pos-workbooks/pos-workbook.schema";
import { UsageEvent, UsageEventSchema } from "./usage-event.schema";
import { DailyAggregate, DailyAggregateSchema } from "./daily-aggregate.schema";
import { Campaign, CampaignSchema } from "./campaign.schema";
import { CampaignVisit, CampaignVisitSchema } from "./campaign-visit.schema";
import { AnalyticsService } from "./analytics.service";
import { AdminGuard } from "./admin.guard";
import { AdminAnalyticsController, AnalyticsController, PublicCampaignController } from "./analytics.controller";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UsageEvent.name, schema: UsageEventSchema },
      { name: DailyAggregate.name, schema: DailyAggregateSchema },
      { name: Campaign.name, schema: CampaignSchema },
      { name: CampaignVisit.name, schema: CampaignVisitSchema },
      { name: User.name, schema: UserSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Workbook.name, schema: WorkbookSchema },
      { name: PosWorkbook.name, schema: PosWorkbookSchema },
    ]),
  ],
  controllers: [AnalyticsController, PublicCampaignController, AdminAnalyticsController],
  providers: [AnalyticsService, AdminGuard],
  exports: [AnalyticsService, AdminGuard],
})
export class AnalyticsModule {}
