import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ExampleWorkbooksService,
  type ExampleWorkbookResponse,
  type PosExampleBundle,
  type IeExampleBundle,
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

  @Get(":slug")
  @HttpCode(HttpStatus.OK)
  getBySlug(@Param("slug") slug: string): Promise<ExampleWorkbookResponse> {
    return this.exampleWorkbooksService.findBySlug(slug);
  }
}
