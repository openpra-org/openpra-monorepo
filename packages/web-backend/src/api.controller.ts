import { Controller } from "@nestjs/common";
import { TypedRoute } from "@nestia/core";
import { ApiService } from "./api.service";

@Controller()
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @TypedRoute.Get()
  public getHello(): string {
    return this.apiService.getHello();
  }
}
