import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ApiService {
  private readonly logger = new Logger(ApiService.name);

  getHello(): string {
    this.logger.log("This is a test logging message!!!"); // Log a simple message
    return "Hello World!";
  }
}
