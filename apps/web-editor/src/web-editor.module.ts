import { Module } from '@nestjs/common';
import { WebEditorController } from './web-editor.controller';
import { WebEditorService } from './web-editor.service';

@Module({
  imports: [],
  controllers: [WebEditorController],
  providers: [WebEditorService],
})
export class WebEditorModule {}
