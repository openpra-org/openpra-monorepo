import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ExampleWorkbooksService,
  type ExampleWorkbookResponse,
  type PosExampleBundle,
  type IeExampleBundle,
  type EsExampleBundle,
  type ScExampleBundle,
  type SyExampleBundle,
} from "./example-workbooks.service";

@Controller("example-workbooks")
@UseGuards(JwtAuthGuard)
export class ExampleWorkbooksController {
  constructor(private readonly exampleWorkbooksService: ExampleWorkbooksService) {}

  @Get("pos-bundle")
  @HttpCode(HttpStatus.OK)
  getPosBundle(): Promise<PosExampleBundle> {
    return this.exampleWorkbooksService.getPosBundle();
  }

  @Get("ie-bundle")
  @HttpCode(HttpStatus.OK)
  getIeBundle(): Promise<IeExampleBundle> {
    return this.exampleWorkbooksService.getIeBundle();
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

  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  getBySlug(@Param("slug") slug: string): Promise<ExampleWorkbookResponse> {
    return this.exampleWorkbooksService.findBySlug(slug);
  }
}
