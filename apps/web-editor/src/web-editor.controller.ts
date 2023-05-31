import { Controller, Get } from '@nestjs/common';
import { WebEditorService } from './web-editor.service';

@Controller()
export class WebEditorController {
  constructor(private readonly webEditorService: WebEditorService) {}

  @Get()
  getHello(): string {
    return this.webEditorService.getHello();
  }
}
