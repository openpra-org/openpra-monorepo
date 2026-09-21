import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { RcWeatherService } from "./rc-weather.service";

@Controller("rc-workbooks/:id/weather")
@UseGuards(JwtAuthGuard)
export class RcWeatherController {
  constructor(private readonly weather: RcWeatherService) {}
  @Post("import/:kind")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 1 } }))
  importFile(@Param("id") id: string, @Param("kind") kind: string, @Body("baseRevision") revision: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined, @Req() req: AuthenticatedRequest) {
    if (!file || revision === undefined || !/^\d+$/.test(revision) || !["weather", "configuration"].includes(kind)) throw new BadRequestException("Provide file, baseRevision and weather or configuration input kind");
    return this.weather.importFile(id, kind as "weather" | "configuration", Number(revision), file, { username: req.user!.username });
  }
  @Patch()
  save(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.weather.save(id, body, { username: req.user!.username }); }
  @Post("collection-request")
  @HttpCode(200)
  collect(@Param("id") id: string, @Body() body: unknown, @Req() req: AuthenticatedRequest) { return this.weather.prepareCollection(id, body, { username: req.user!.username }); }
  @Get("files/:documentId")
  original(@Param("id") id: string, @Param("documentId") documentId: string, @Req() req: AuthenticatedRequest) { return this.weather.original(id, documentId, { username: req.user!.username }); }
  @Get("records")
  records(@Param("id") id: string, @Query("offset") offset = "0", @Query("limit") limit = "6", @Req() req: AuthenticatedRequest) { return this.weather.records(id, Number(offset), Number(limit), { username: req.user!.username }); }
  @Get("trials")
  trials(@Param("id") id: string, @Query("offset") offset = "0", @Query("limit") limit = "6", @Req() req: AuthenticatedRequest) { return this.weather.trials(id, Number(offset), Number(limit), { username: req.user!.username }); }
}
