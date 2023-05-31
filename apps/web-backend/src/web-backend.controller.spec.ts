import { Test, TestingModule } from '@nestjs/testing';
import { WebBackendController } from './web-backend.controller';
import { WebBackendService } from './web-backend.service';

describe('WebBackendController', () => {
  let webBackendController: WebBackendController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WebBackendController],
      providers: [WebBackendService],
    }).compile();

    webBackendController = app.get<WebBackendController>(WebBackendController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(webBackendController.getHello()).toBe('Hello World!');
    });
  });
});
