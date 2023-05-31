import { Injectable } from '@nestjs/common';

@Injectable()
export class WebBackendService {
  getHello(): string {
    return 'Hello World!';
  }
}
