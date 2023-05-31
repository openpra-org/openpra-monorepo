import { Injectable } from '@nestjs/common';

@Injectable()
export class WebEditorService {
  getHello(): string {
    return 'Hello World!';
  }
}
