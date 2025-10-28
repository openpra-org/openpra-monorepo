import { Injectable } from "@nestjs/common";

/**
 * Trivial root API service used by the health/greeting controller.
 * @public
 */
@Injectable()
export class ApiService {
  getHello(): string {
    return "Hello World!";
  }
}
