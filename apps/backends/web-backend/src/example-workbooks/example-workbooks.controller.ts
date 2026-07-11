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

  @Get("ri-bundle")
  @HttpCode(HttpStatus.OK)
  getRiBundle(): Promise<RiExampleBundle> {
    return this.exampleWorkbooksService.getRiBundle();
  }

  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  getBySlug(@Param("slug") slug: string): Promise<ExampleWorkbookResponse> {
    return this.exampleWorkbooksService.findBySlug(slug);
  }
}
