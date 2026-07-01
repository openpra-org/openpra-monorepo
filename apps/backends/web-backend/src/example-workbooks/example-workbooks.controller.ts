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

  @Get("es-bundle")
  @HttpCode(HttpStatus.OK)
  getEsBundle(): Promise<EsExampleBundle> {
    return this.exampleWorkbooksService.getEsBundle();
  }

  @Get("sc-bundle")
  @HttpCode(HttpStatus.OK)
  getScBundle(): Promise<ScExampleBundle> {
    return this.exampleWorkbooksService.getScBundle();
  }

  @Get("sy-bundle")
  @HttpCode(HttpStatus.OK)
  getSyBundle(): Promise<SyExampleBundle> {
    return this.exampleWorkbooksService.getSyBundle();
  }

  @Get("hr-bundle")
  @HttpCode(HttpStatus.OK)
  getHrBundle(): Promise<HrExampleBundle> {
    return this.exampleWorkbooksService.getHrBundle();
  }

  @Get("da-bundle")
  @HttpCode(HttpStatus.OK)
  getDaBundle(): Promise<DaExampleBundle> {
    return this.exampleWorkbooksService.getDaBundle();
  }

  @Get("esq-bundle")
  @HttpCode(HttpStatus.OK)
  getEsqBundle(): Promise<EsqExampleBundle> {
    return this.exampleWorkbooksService.getEsqBundle();
  }

  @Get("ms-bundle")
  @HttpCode(HttpStatus.OK)
  getMsBundle(): Promise<MsExampleBundle> {
    return this.exampleWorkbooksService.getMsBundle();
  }

  @Get("rc-bundle")
  @HttpCode(HttpStatus.OK)
  getRcBundle(): Promise<RcExampleBundle> {
    return this.exampleWorkbooksService.getRcBundle();
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
