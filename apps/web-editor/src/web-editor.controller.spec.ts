import { Test, TestingModule } from '@nestjs/testing';
import { WebEditorController } from './web-editor.controller';
import { WebEditorService } from './web-editor.service';

describe('WebEditorController', () => {
  let webEditorController: WebEditorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WebEditorController],
      providers: [WebEditorService],
    }).compile();

    webEditorController = app.get<WebEditorController>(WebEditorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(webEditorController.getHello()).toBe('Hello World!');
    });
  });
});
