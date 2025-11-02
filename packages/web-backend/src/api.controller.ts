import { Controller, Get } from "@nestjs/common";
import { ApiService } from "./api.service";

/**
 * Root API controller for basic service health and greetings.
 */
@Controller()
export class ApiController {
  /**
   * @param apiService Service providing simple API responses (health/greeting).
   */
  constructor(private readonly apiService: ApiService) {}

  /**
   * Health check / service greeting endpoint.
   *
   * @returns A short greeting string to verify the service is up.
   */
  @Get()
  getHello(): string {
    return this.apiService.getHello();
  }
}
