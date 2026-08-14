import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ExampleWorkbooksService,
  type ExampleWorkbookResponse,
  type PosExampleBundle,
  type PosExampleOption,
  type IeExampleBundle,
  type IeExampleOption,
  type EsExampleBundle,
  type ScExampleBundle,
  type SyExampleBundle,
  type HrExampleBundle,
  type DaExampleBundle,
  type EsqExampleBundle,
  type MsExampleBundle,
  type RcExampleBundle,
  type RiExampleBundle,
  type SeismicPraExampleBundle,
  type InternalFloodPraExampleBundle,
  type InternalFirePraExampleBundle,
  type HazardsScreeningAnalysisExampleBundle,
  type HighWindsPraExampleBundle,
  type ExternalFloodPraExampleBundle,
  type OtherHazardsPraExampleBundle,
} from "./example-workbooks.service";

@Controller("example-workbooks")
@UseGuards(JwtAuthGuard)
export class ExampleWorkbooksController {
  constructor(private readonly exampleWorkbooksService: ExampleWorkbooksService) {}

  @Get("pos-examples")
  @HttpCode(HttpStatus.OK)
  getPosExamples(): PosExampleOption[] {
    return this.exampleWorkbooksService.getPosExamples();
  }

  @Get("pos-bundle")
  @HttpCode(HttpStatus.OK)
  getPosBundle(@Query("example") example?: string): Promise<PosExampleBundle> {
    return this.exampleWorkbooksService.getPosBundle(example);
  }

  @Get("ie-examples")
  @HttpCode(HttpStatus.OK)
  getIeExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getIeExamples();
  }

  @Get("ie-bundle")
  @HttpCode(HttpStatus.OK)
  getIeBundle(@Query("example") example?: string): Promise<IeExampleBundle> {
    return this.exampleWorkbooksService.getIeBundle(example);
  }

  @Get("es-examples")
  @HttpCode(HttpStatus.OK)
  getEsExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getEsExamples();
  }

  @Get("es-bundle")
  @HttpCode(HttpStatus.OK)
  getEsBundle(@Query("example") example?: string): Promise<EsExampleBundle> {
    return this.exampleWorkbooksService.getEsBundle(example);
  }

  @Get("sc-examples")
  @HttpCode(HttpStatus.OK)
  getScExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getScExamples();
  }

  @Get("sc-bundle")
  @HttpCode(HttpStatus.OK)
  getScBundle(@Query("example") example?: string): Promise<ScExampleBundle> {
    return this.exampleWorkbooksService.getScBundle(example);
  }

  @Get("sy-examples")
  @HttpCode(HttpStatus.OK)
  getSyExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getSyExamples();
  }

  @Get("sy-bundle")
  @HttpCode(HttpStatus.OK)
  getSyBundle(@Query("example") example?: string): Promise<SyExampleBundle> {
    return this.exampleWorkbooksService.getSyBundle(example);
  }

  @Get("hr-examples")
  @HttpCode(HttpStatus.OK)
  getHrExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getHrExamples();
  }

  @Get("hr-bundle")
  @HttpCode(HttpStatus.OK)
  getHrBundle(@Query("example") example?: string): Promise<HrExampleBundle> {
    return this.exampleWorkbooksService.getHrBundle(example);
  }

  @Get("da-examples")
  @HttpCode(HttpStatus.OK)
  getDaExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getDaExamples();
  }

  @Get("da-bundle")
  @HttpCode(HttpStatus.OK)
  getDaBundle(@Query("example") example?: string): Promise<DaExampleBundle> {
    return this.exampleWorkbooksService.getDaBundle(example);
  }

  @Get("esq-examples")
  @HttpCode(HttpStatus.OK)
  getEsqExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getEsqExamples();
  }

  @Get("esq-bundle")
  @HttpCode(HttpStatus.OK)
  getEsqBundle(@Query("example") example?: string): Promise<EsqExampleBundle> {
    return this.exampleWorkbooksService.getEsqBundle(example);
  }

  @Get("ms-examples")
  @HttpCode(HttpStatus.OK)
  getMsExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getMsExamples();
  }

  @Get("ms-bundle")
  @HttpCode(HttpStatus.OK)
  getMsBundle(@Query("example") example?: string): Promise<MsExampleBundle> {
    return this.exampleWorkbooksService.getMsBundle(example);
  }

  @Get("rc-examples")
  @HttpCode(HttpStatus.OK)
  getRcExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getRcExamples();
  }

  @Get("rc-bundle")
  @HttpCode(HttpStatus.OK)
  getRcBundle(@Query("example") example?: string): Promise<RcExampleBundle> {
    return this.exampleWorkbooksService.getRcBundle(example);
  }

  @Get("ri-examples")
  @HttpCode(HttpStatus.OK)
  getRiExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getRiExamples();
  }

  @Get("ri-bundle")
  @HttpCode(HttpStatus.OK)
  getRiBundle(@Query("example") example?: string): Promise<RiExampleBundle> {
    return this.exampleWorkbooksService.getRiBundle(example);
  }

  @Get("seismic-pra-examples")
  @HttpCode(HttpStatus.OK)
  getSeismicPraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getSeismicPraExamples();
  }

  @Get("seismic-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getSeismicPraBundle(@Query("example") example?: string): Promise<SeismicPraExampleBundle> {
    return this.exampleWorkbooksService.getSeismicPraBundle(example);
  }

  @Get("internal-flood-pra-examples")
  @HttpCode(HttpStatus.OK)
  getInternalFloodPraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getInternalFloodPraExamples();
  }

  @Get("internal-flood-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getInternalFloodPraBundle(@Query("example") example?: string): Promise<InternalFloodPraExampleBundle> {
    return this.exampleWorkbooksService.getInternalFloodPraBundle(example);
  }

  @Get("internal-fire-pra-examples")
  @HttpCode(HttpStatus.OK)
  getInternalFirePraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getInternalFirePraExamples();
  }

  @Get("internal-fire-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getInternalFirePraBundle(@Query("example") example?: string): Promise<InternalFirePraExampleBundle> {
    return this.exampleWorkbooksService.getInternalFirePraBundle(example);
  }

  @Get("hazards-screening-analysis-examples")
  @HttpCode(HttpStatus.OK)
  getHazardsScreeningAnalysisExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getHazardsScreeningAnalysisExamples();
  }

  @Get("hazards-screening-analysis-bundle")
  @HttpCode(HttpStatus.OK)
  getHazardsScreeningAnalysisBundle(@Query("example") example?: string): Promise<HazardsScreeningAnalysisExampleBundle> {
    return this.exampleWorkbooksService.getHazardsScreeningAnalysisBundle(example);
  }

  @Get("high-winds-pra-examples")
  @HttpCode(HttpStatus.OK)
  getHighWindsPraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getHighWindsPraExamples();
  }

  @Get("high-winds-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getHighWindsPraBundle(@Query("example") example?: string): Promise<HighWindsPraExampleBundle> {
    return this.exampleWorkbooksService.getHighWindsPraBundle(example);
  }

  @Get("external-flood-pra-examples")
  @HttpCode(HttpStatus.OK)
  getExternalFloodPraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getExternalFloodPraExamples();
  }

  @Get("external-flood-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getExternalFloodPraBundle(@Query("example") example?: string): Promise<ExternalFloodPraExampleBundle> {
    return this.exampleWorkbooksService.getExternalFloodPraBundle(example);
  }

  @Get("other-hazards-pra-examples")
  @HttpCode(HttpStatus.OK)
  getOtherHazardsPraExamples(): IeExampleOption[] {
    return this.exampleWorkbooksService.getOtherHazardsPraExamples();
  }

  @Get("other-hazards-pra-bundle")
  @HttpCode(HttpStatus.OK)
  getOtherHazardsPraBundle(@Query("example") example?: string): Promise<OtherHazardsPraExampleBundle> {
    return this.exampleWorkbooksService.getOtherHazardsPraBundle(example);
  }

  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  getBySlug(@Param("slug") slug: string): Promise<ExampleWorkbookResponse> {
    return this.exampleWorkbooksService.findBySlug(slug);
  }
}
