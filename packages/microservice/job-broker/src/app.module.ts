import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuantificationJobReport, QuantificationJobReportSchema, ExecutableJobReport, ExecutableJobReportSchema } from './schemas/job-reports.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuantificationJobReport.name, schema: QuantificationJobReportSchema },
      { name: ExecutableJobReport.name, schema: ExecutableJobReportSchema },
    ]),
  ],
})
export class AppModule {} 