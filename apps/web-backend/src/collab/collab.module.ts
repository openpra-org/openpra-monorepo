import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';
import { HclModule } from '../hcl/hcl.module';
import { UserCounter, UserCounterSchema } from './schemas/user-counter.schema';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    HclModule,
    MongooseModule.forFeature([
      { name: UserCounter.name, schema: UserCounterSchema },
      { name: User.name, schema: UserSchema }
    ])
  ],
  controllers: [CollabController],
  providers: [CollabService],
  exports: [CollabService]
})

export class CollabModule {}