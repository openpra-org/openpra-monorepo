import { Controller, Get } from '@nestjs/common';
import { WebBackendService } from './web-backend.service';

@Controller()
export class WebBackendController {
  constructor(private readonly webBackendService: WebBackendService) {}

  @Get()
  getHello(): string {
    return this.webBackendService.getHello();
  }
}
