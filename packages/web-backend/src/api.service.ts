import { Injectable } from '@nestjs/common';

/**
 * Trivial root API service used by the health/greeting controller.
 * @public
 */
@Injectable()
export class ApiService {
  /**
   * Return a simple greeting for health checks.
   * @returns "Hello World!" greeting string.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
