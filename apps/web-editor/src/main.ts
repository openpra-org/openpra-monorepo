import { NestFactory } from '@nestjs/core';
import { WebEditorModule } from './web-editor.module';

async function bootstrap() {
  const app = await NestFactory.create(WebEditorModule);
  await app.listen(3000);
}
bootstrap();
