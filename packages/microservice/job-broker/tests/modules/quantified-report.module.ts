import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QuantifiedReport, QuantifiedReportSchema } from "../../src/quantification/schemas/quantified-report.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: QuantifiedReport.name, schema: QuantifiedReportSchema }])],
  exports: [MongooseModule.forFeature([{ name: QuantifiedReport.name, schema: QuantifiedReportSchema }])],
})
export class QuantifiedReportModule {}
