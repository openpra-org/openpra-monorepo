import { Module } from '@nestjs/common';
import { WebBackendController } from './web-backend.controller';
import { WebBackendService } from './web-backend.service';

@Module({
  imports: [],
  controllers: [WebBackendController],
  providers: [WebBackendService],
})
export class WebBackendModule {}
